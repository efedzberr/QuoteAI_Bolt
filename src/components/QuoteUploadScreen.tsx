import { useState, useCallback, useRef, useEffect, DragEvent } from 'react';
import { Upload, Check, X, Lock, FileSpreadsheet, FileText, Image, Search, Loader2 } from 'lucide-react';
import Header from './Header';
import DebugPanel from './DebugPanel';
import { useDebugLogs } from '../hooks/useDebugLogs';
import { useAuth } from '../hooks/useAuth';
import FractionalQuantitiesDialog, {
  type FractionalRow,
  type FractionalDecision,
} from './FractionalQuantitiesDialog';

interface SalesforceAccount {
  id: string;
  noCliente: string;
  name: string;
  estado: string;
  calle: string;
  ownerId: string;
}

interface ParsedData {
  customerName: string;
  salesforceAccount?: SalesforceAccount;
  rows: any[];
  rawDoclingResponse?: any;
  mappingNotice?: string;
}

interface QuoteUploadScreenProps {
  onFileReady: (data: ParsedData) => void;
  onExtractionComplete?: (rows: any[], customerName: string) => void;
  onCreateManualQuote: (customerName: string) => void;
  onOpenAdmin?: () => void;
  onBackToHome?: () => void;
  initialRows?: any[];
  initialCustomerName?: string;
  initialFileName?: string;
}

type ParseStatus = 'idle' | 'processing' | 'success' | 'error';

const RAILWAY_EXTRACT_URL = 'https://quoteai-production.up.railway.app/extract';
const RAILWAY_ACCOUNTS_URL = 'https://quoteai-production.up.railway.app/accounts/search';

const SUPPORTED_EXTENSIONS = ['xlsx', 'xls', 'csv', 'pdf', 'docx', 'doc', 'txt', 'png', 'jpg', 'jpeg', 'webp'];

export default function QuoteUploadScreen({ onFileReady, onExtractionComplete, onCreateManualQuote, onOpenAdmin, onBackToHome, initialRows, initialCustomerName }: QuoteUploadScreenProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const auth = useAuth();
  const [customerName, setCustomerName] = useState(initialCustomerName || '');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>(initialRows || []);
  const [parseStatus, setParseStatus] = useState<ParseStatus>(initialRows && initialRows.length > 0 ? 'success' : 'idle');
  const [parseError, setParseError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [rowCount, setRowCount] = useState<number>(initialRows?.length || 0);
  const [manualError, setManualError] = useState<string | null>(null);
  const [fractionalRows, setFractionalRows] = useState<FractionalRow[] | null>(null);
  const extractionNotifiedRef = useRef(!!initialRows && initialRows.length > 0);
  const { logs, clearLogs } = useDebugLogs();

  const [sfAccounts, setSfAccounts] = useState<SalesforceAccount[]>([]);
  const [sfSearching, setSfSearching] = useState(false);
  const [sfError, setSfError] = useState<string | null>(null);
  const [sfShowDropdown, setSfShowDropdown] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<SalesforceAccount | null>(null);
  const sfDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sfDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sfDropdownRef.current && !sfDropdownRef.current.contains(e.target as Node)) {
        setSfShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchSalesforceAccounts = useCallback(async (query: string) => {
    if (!query.trim() || query.trim().length < 2) {
      setSfAccounts([]);
      setSfShowDropdown(false);
      return;
    }
    const userEmail = auth.user?.email;
    if (!userEmail) return;

    setSfSearching(true);
    setSfError(null);
    try {
      const res = await fetch(RAILWAY_ACCOUNTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail, query: query.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Error buscando cuentas');
      }
      setSfAccounts(json.records || []);
      setSfShowDropdown(true);
    } catch (err: any) {
      setSfError(err.message || 'Error de conexión');
      setSfAccounts([]);
      setSfShowDropdown(true);
    } finally {
      setSfSearching(false);
    }
  }, [auth.user?.email]);

  const handleCustomerNameChange = useCallback((value: string) => {
    const upper = value.toLocaleUpperCase('es-MX');
    setCustomerName(upper);
    setManualError(null);
    setSelectedAccount(null);

    if (sfDebounceRef.current) clearTimeout(sfDebounceRef.current);
    sfDebounceRef.current = setTimeout(() => {
      searchSalesforceAccounts(upper);
    }, 500);
  }, [searchSalesforceAccounts]);

  const handleCustomerKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (sfDebounceRef.current) clearTimeout(sfDebounceRef.current);
      searchSalesforceAccounts(customerName);
    }
  }, [customerName, searchSalesforceAccounts]);

  const handleSelectAccount = useCallback((account: SalesforceAccount) => {
    setCustomerName(account.name);
    setSelectedAccount(account);
    setSfShowDropdown(false);
    setSfAccounts([]);
    setManualError(null);
  }, []);

  useEffect(() => {
    if (extractionNotifiedRef.current) return;
    if (parseStatus !== 'success' || parsedRows.length === 0) return;
    if (!customerName.trim()) return;
    extractionNotifiedRef.current = true;
    onExtractionComplete?.(parsedRows, customerName.trim());
  }, [parseStatus, parsedRows, customerName, onExtractionComplete]);

  const detectFractionalRows = useCallback((rows: any[]): FractionalRow[] => {
    const fractional: FractionalRow[] = [];
    rows.forEach((row, i) => {
      const raw = row?.Cant;
      const num = parseFloat(raw);
      if (!isFinite(num) || num <= 0) return;
      if (Number.isInteger(num)) return;
      fractional.push({
        index: i + 1,
        descripcion: String(row?.Descripcion ?? ''),
        valorOriginal: num,
        valorRedondeado: Math.ceil(num),
        valorTruncado: Math.floor(num),
      });
    });
    return fractional;
  }, []);

  const handleFractionalConfirm = useCallback(
    (decisions: Record<number, FractionalDecision>) => {
      if (!fractionalRows) return;
      const decisionsByZeroBasedIndex = new Map<number, FractionalDecision>();
      fractionalRows.forEach((fr) => {
        decisionsByZeroBasedIndex.set(fr.index - 1, decisions[fr.index]);
      });
      setParsedRows((prevRows) => {
        const updated = prevRows.map((row, i) => {
          const decision = decisionsByZeroBasedIndex.get(i);
          if (!decision) return row;
          const num = parseFloat(row?.Cant);
          if (!isFinite(num)) return row;
          const newQty = decision === 'round' ? Math.ceil(num) : Math.floor(num);
          return { ...row, Cant: String(Math.max(1, newQty)) };
        });
        return updated;
      });
      setFractionalRows(null);
    },
    [fractionalRows]
  );

  const handleFractionalCancel = useCallback(() => {
    setFractionalRows(null);
    setSelectedFile(null);
    setParsedRows([]);
    setParseStatus('idle');
    setParseError(null);
    setRowCount(0);
    extractionNotifiedRef.current = false;
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const extractViaRailway = useCallback(async (file: File) => {
    setParseStatus('processing');
    setParseError(null);

    try {
      const form = new FormData();
      form.append('file', file);

      let response: Response;
      try {
        response = await fetch(RAILWAY_EXTRACT_URL, {
          method: 'POST',
          body: form,
        });
      } catch (fetchErr: any) {
        throw new Error(`Error de red al conectar con el servicio de extraccion: ${fetchErr?.message || String(fetchErr)}`);
      }

      const text = await response.text();
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(`Respuesta no es JSON valido (HTTP ${response.status}): ${text.substring(0, 300)}`);
      }

      if (!response.ok) {
        throw new Error(json?.error || `Error del servidor (HTTP ${response.status}): ${text.substring(0, 300)}`);
      }

      if (json?.error) {
        throw new Error(json.error);
      }

      const rows = json?.data || [];

      if (rows.length === 0) {
        setParseError('No se encontraron productos en el archivo. Verifica que contenga una lista clara con productos, cantidades y descripciones.');
        setParseStatus('error');
        return;
      }

      setParsedRows(rows);
      setRowCount(rows.length);
      setParseStatus('success');

      const fractional = detectFractionalRows(rows);
      if (fractional.length > 0) {
        setFractionalRows(fractional);
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.error('[extractViaRailway] Error:', msg);
      setParseError(`Error al extraer productos: ${msg}`);
      setParseStatus('error');
    }
  }, [detectFractionalRows]);

  const processFile = useCallback((file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase();

    if (!extension || !SUPPORTED_EXTENSIONS.includes(extension)) {
      setParseError('Formato de archivo no soportado.');
      setSelectedFile(null);
      setParseStatus('error');
      return;
    }

    setSelectedFile(file);
    setParseError(null);
    extractViaRailway(file);
  }, [extractViaRailway]);

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'xlsx':
      case 'xls':
      case 'csv':
        return <FileSpreadsheet className="w-6 h-6 text-green-600 flex-shrink-0" />;
      case 'pdf':
        return <FileText className="w-6 h-6 text-red-600 flex-shrink-0" />;
      case 'docx':
      case 'doc':
        return <FileText className="w-6 h-6 text-blue-600 flex-shrink-0" />;
      case 'txt':
        return <FileText className="w-6 h-6 text-gray-600 flex-shrink-0" />;
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'webp':
        return <Image className="w-6 h-6 text-orange-500 flex-shrink-0" />;
      default:
        return <Upload className="w-6 h-6 text-gray-600 flex-shrink-0" />;
    }
  };

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      processFile(droppedFiles[0]);
    }
  }, [processFile]);

  const handleRemoveFile = useCallback(() => {
    setSelectedFile(null);
    setParsedRows([]);
    setParseStatus('idle');
    setParseError(null);
    setRowCount(0);
    extractionNotifiedRef.current = false;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleCreateManual = () => {
    if (!customerName.trim()) {
      setManualError('Please enter a customer name first');
      return;
    }
    setManualError(null);
    onCreateManualQuote(customerName.trim());
  };

  const handleSubmit = async () => {
    if (!customerName.trim()) return;
    if (parsedRows.length === 0) return;
    onFileReady({
      customerName: customerName.trim(),
      salesforceAccount: selectedAccount || undefined,
      rows: parsedRows,
    });
  };

  const isButtonEnabled =
    customerName.trim() !== '' &&
    parseStatus === 'success';

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="min-h-screen bg-[#F3F3F3]" style={{ fontFamily: "'Manrope', sans-serif" }}>
      <Header hideHeader onAdminClick={onOpenAdmin} onHomeClick={onBackToHome} />

      {/* Page header */}
      <div className="max-w-[1100px] mx-auto px-7 pt-8 pb-6">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0">
            <h1
              className="font-bold text-[#181818] tracking-[-0.02em]"
              style={{ fontFamily: "'Manrope', sans-serif", fontSize: 28, lineHeight: 1.15 }}
            >
              Nueva cotización
            </h1>
            <p
              className="text-[#747474] mt-2 max-w-[640px]"
              style={{ fontFamily: "'Manrope', sans-serif", fontSize: 14 }}
            >
              Sube una orden de compra o lista de productos y la procesaremos por ti.
            </p>
          </div>
        </div>
      </div>

      {/* Main content grid */}
      <div className="max-w-[1100px] mx-auto px-7 pb-12">
        <div className="grid lg:grid-cols-[1fr_320px] gap-6">

          {/* Left column - Form card */}
          <div className="bg-white border border-[#E5E5E5] rounded-xl p-8"
               style={{ boxShadow: '0 1px 2px rgba(0,0,0,.05)' }}>

            {/* Section A - Customer Information */}
            <div className="mb-6">
              <label
                className="block uppercase mb-2 text-[#747474]"
                style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em' }}
              >
                Cliente o referencia
              </label>
              <div className="relative" ref={sfDropdownRef}>
                <div className="relative">
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => handleCustomerNameChange(e.target.value)}
                    onKeyDown={handleCustomerKeyDown}
                    onFocus={() => { if (sfAccounts.length > 0) setSfShowDropdown(true); }}
                    placeholder="ej. Constructora del Norte – OC-2024-0091"
                    className="w-full px-3.5 py-3 pr-10 border border-[#E5E5E5] rounded-lg text-[#181818] placeholder:text-[#A3A3A3] focus:outline-none focus:border-[#0176D3] focus:ring-[3px] focus:ring-[#EAF5FE] transition-all"
                    style={{ fontSize: 14 }}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {sfSearching ? (
                      <Loader2 className="w-4 h-4 text-[#0176D3] animate-spin" />
                    ) : (
                      <Search className="w-4 h-4 text-[#A3A3A3]" />
                    )}
                  </div>
                </div>

                {sfShowDropdown && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-[#E5E5E5] rounded-lg shadow-lg max-h-[240px] overflow-y-auto">
                    {sfSearching ? (
                      <div className="px-4 py-3 flex items-center gap-2 text-[#0176D3]" style={{ fontSize: 13 }}>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Buscando en Salesforce...
                      </div>
                    ) : sfError ? (
                      <div className="px-4 py-3 text-[#B86C00]" style={{ fontSize: 13 }}>
                        {sfError}
                      </div>
                    ) : sfAccounts.length === 0 ? (
                      <div className="px-4 py-3 text-[#747474]" style={{ fontSize: 13 }}>
                        No se encontraron cuentas. Puedes continuar con texto libre.
                      </div>
                    ) : (
                      sfAccounts.map((acc) => (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() => handleSelectAccount(acc)}
                          className="w-full text-left px-4 py-2.5 hover:bg-[#EAF5FE] transition-colors border-b border-[#F0F0F0] last:border-0"
                        >
                          <p className="text-[#181818] font-semibold" style={{ fontSize: 13 }}>{acc.name}</p>
                          <p className="text-[#747474]" style={{ fontSize: 11 }}>
                            No. {acc.noCliente} &middot; {acc.calle}, {acc.estado}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {selectedAccount ? (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 text-[#2E844A] bg-[#DEF5E5] px-2 py-0.5 rounded text-[11px] font-semibold">
                    <Check className="w-3 h-3" /> Salesforce
                  </span>
                  <span className="text-[#747474]" style={{ fontSize: 11 }}>
                    No. {selectedAccount.noCliente}
                  </span>
                </div>
              ) : (
                <p className="mt-1.5 text-[#747474]" style={{ fontSize: 12 }}>
                  Escribe para buscar en Salesforce o usa un nombre libre.
                </p>
              )}
              {manualError && (
                <p className="mt-1.5 text-[#BA0517]" style={{ fontSize: 13 }}>{manualError}</p>
              )}
            </div>

            {/* Section B - File Upload */}
            <div className="mb-6">
              <label
                className="block uppercase mb-2 text-[#747474]"
                style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em' }}
              >
                Archivo de la cotización
              </label>

              {/* Upload Zone */}
              {!selectedFile && parseStatus !== 'success' && (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`
                    relative rounded-xl border-2 border-dashed transition-all cursor-pointer
                    ${isDragging
                      ? 'border-[#0176D3] bg-[#EAF5FE]'
                      : 'border-[#D1D5DB] bg-[#FAFAFA] hover:border-[#0176D3] hover:bg-[#EAF5FE]'
                    }
                  `}
                  style={{ minHeight: 200, padding: '32px 24px' }}
                >
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv,.pdf,.docx,.doc,.txt,.png,.jpg,.jpeg,.webp"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                  <div className="flex flex-col items-center justify-center text-center pointer-events-none">
                    <div className="w-14 h-14 rounded-full bg-[#EAF5FE] flex items-center justify-center mb-4">
                      <Upload className="w-7 h-7 text-[#0176D3]" strokeWidth={1.8} />
                    </div>
                    <p className="text-[#181818] mb-1" style={{ fontSize: 15, fontWeight: 600 }}>
                      Arrastra y suelta tu archivo aquí
                    </p>
                    <p className="text-[#0176D3] underline mb-3" style={{ fontSize: 13, fontWeight: 500 }}>
                      o haz clic para buscarlo
                    </p>
                    <p className="text-[#747474]" style={{ fontSize: 12 }}>
                      Formatos soportados: PDF, XLSX, XLS, CSV, DOCX, TXT, PNG, JPG, WEBP · Max. 20 MB
                    </p>
                  </div>
                </div>
              )}

              {/* File Selected State */}
              {selectedFile && (
                <div
                  className={`
                    rounded-xl border flex items-center justify-center px-5 py-4
                    ${parseStatus === 'success'
                      ? 'border-[#2E844A] bg-[#DEF5E5]'
                      : parseStatus === 'error'
                      ? 'border-[#B86C00] bg-[#FEF1DC]'
                      : 'border-[#E5E5E5] bg-[#FAFAFA]'
                    }
                  `}
                  style={{ minHeight: 88 }}
                >
                  <div className="flex items-center gap-4 w-full">
                    {parseStatus === 'success' && (
                      <div className="w-10 h-10 rounded-full bg-[#2E844A] flex items-center justify-center flex-shrink-0">
                        <Check className="w-5 h-5 text-white" strokeWidth={2.5} />
                      </div>
                    )}
                    {parseStatus === 'processing' && (
                      <div className="w-10 h-10 rounded-full bg-[#EAF5FE] flex items-center justify-center flex-shrink-0">
                        {getFileIcon(selectedFile.name)}
                      </div>
                    )}
                    {parseStatus === 'error' && (
                      <div className="w-10 h-10 rounded-full bg-[#FEF1DC] flex items-center justify-center flex-shrink-0">
                        {getFileIcon(selectedFile.name)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[#181818] truncate" style={{ fontSize: 14, fontWeight: 600 }}>
                        {selectedFile.name}
                      </p>
                      <p className="text-[#747474]" style={{ fontSize: 12 }}>
                        {formatFileSize(selectedFile.size)}
                      </p>
                    </div>
                    {parseStatus !== 'processing' && (
                      <button
                        onClick={handleRemoveFile}
                        className="flex-shrink-0 w-8 h-8 rounded-full hover:bg-white flex items-center justify-center transition-colors"
                        aria-label="Quitar archivo"
                      >
                        <X className="w-4 h-4 text-[#747474]" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Resumed extraction state (no file, but rows pre-loaded) */}
              {!selectedFile && parseStatus === 'success' && parsedRows.length > 0 && (
                <div
                  className="rounded-xl border border-[#2E844A] bg-[#DEF5E5] flex items-center px-5 py-4"
                  style={{ minHeight: 88 }}
                >
                  <div className="flex items-center gap-4 w-full">
                    <div className="w-10 h-10 rounded-full bg-[#2E844A] flex items-center justify-center flex-shrink-0">
                      <Check className="w-5 h-5 text-white" strokeWidth={2.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[#181818]" style={{ fontSize: 14, fontWeight: 600 }}>
                        Datos de extraccion cargados
                      </p>
                      <p className="text-[#747474]" style={{ fontSize: 12 }}>
                        {parsedRows.length} {parsedRows.length === 1 ? 'fila' : 'filas'} listas para procesar
                      </p>
                    </div>
                    <button
                      onClick={handleRemoveFile}
                      className="flex-shrink-0 w-8 h-8 rounded-full hover:bg-white flex items-center justify-center transition-colors"
                      aria-label="Descartar datos"
                    >
                      <X className="w-4 h-4 text-[#747474]" />
                    </button>
                  </div>
                </div>
              )}

              {/* Parse Status Messages */}
              <div className="mt-3 min-h-[20px]">
                {parseStatus === 'processing' && (
                  <div className="flex items-center gap-2.5 text-[#0176D3]" style={{ fontSize: 13 }}>
                    <div className="w-4 h-4 border-2 border-[#0176D3] border-t-transparent rounded-full animate-spin"></div>
                    <div className="flex flex-col gap-0">
                      <span style={{ fontWeight: 600 }}>Analizando con IA…</span>
                      <span className="text-[#747474]" style={{ fontSize: 12 }}>
                        Extrayendo productos del archivo…
                      </span>
                    </div>
                  </div>
                )}
                {parseStatus === 'success' && (
                  <div className="flex items-center gap-2 text-[#2E844A]" style={{ fontSize: 13, fontWeight: 600 }}>
                    <Check className="w-4 h-4" />
                    <span>{rowCount} {rowCount === 1 ? 'fila detectada' : 'filas detectadas'}</span>
                  </div>
                )}
                {parseStatus === 'error' && (
                  <div className="text-[#B86C00]" style={{ fontSize: 13, fontWeight: 600 }}>
                    {parseError || 'No pudimos leer el archivo. Verifica el formato.'}
                  </div>
                )}
              </div>
            </div>

            {/* Process Button */}
            <button
              onClick={handleSubmit}
              disabled={!isButtonEnabled}
              className={`
                mt-6 w-full h-12 rounded-lg text-white transition-all flex items-center justify-center gap-2
                ${isButtonEnabled
                  ? 'bg-[#0176D3] hover:bg-[#014486] cursor-pointer'
                  : 'bg-[#D1D5DB] cursor-not-allowed'
                }
              `}
              style={{ fontSize: 14, fontWeight: 700 }}
            >
              Revisar Extracción
            </button>

            {/* Helper Text */}
            <div className="mt-4 flex items-center justify-center gap-2 text-[#747474]" style={{ fontSize: 12 }}>
              <Lock className="w-3.5 h-3.5" />
              <span>Tu archivo se procesa de forma segura y se almacena cifrado.</span>
            </div>
          </div>

          {/* Right column - Help cards */}
          <div className="space-y-4">

            {/* How it works card */}
            <div className="bg-white border border-[#E5E5E5] rounded-xl p-6"
                 style={{ boxShadow: '0 1px 2px rgba(0,0,0,.05)' }}>
              <h3 className="text-[#181818] mb-4" style={{ fontSize: 14, fontWeight: 700 }}>
                ¿Cómo funciona?
              </h3>
              <ol className="space-y-3.5">
                {[
                  { n: 1, t: 'Sube tu archivo', d: 'Aceptamos PDF, Excel, Word e imágenes' },
                  { n: 2, t: 'Lectura automática', d: 'Nuestra IA identifica productos del catálogo' },
                  { n: 3, t: 'Revisa y envía', d: 'Confirma los items y genera la cotización' },
                ].map(step => (
                  <li key={step.n} className="flex items-start gap-3">
                    <div
                      className="flex-shrink-0 w-6 h-6 rounded-full bg-[#EAF5FE] text-[#0176D3] flex items-center justify-center"
                      style={{ fontSize: 12, fontWeight: 700 }}
                    >
                      {step.n}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[#181818]" style={{ fontSize: 13, fontWeight: 600 }}>
                        {step.t}
                      </p>
                      <p className="text-[#747474] mt-0.5" style={{ fontSize: 12, lineHeight: 1.4 }}>
                        {step.d}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* Manual quote card */}
            <div className="bg-[#EAF5FE] border border-[#0176D3]/20 rounded-xl p-5">
              <p className="text-[#181818] mb-3" style={{ fontSize: 13, lineHeight: 1.45 }}>
                ¿No tienes un archivo? Puedes crear la cotización producto por
                producto desde el catálogo.
              </p>
              <button
                onClick={handleCreateManual}
                className="w-full h-10 rounded-lg bg-white text-[#0176D3] border border-[#0176D3] hover:bg-white/70 transition-all flex items-center justify-center gap-2"
                style={{ fontSize: 13, fontWeight: 700 }}
              >
                Crear cotización manual
              </button>
            </div>

          </div>
        </div>

        <DebugPanel logs={logs} onClear={clearLogs} />
      </div>

      {fractionalRows && (
        <FractionalQuantitiesDialog
          rows={fractionalRows}
          onCancel={handleFractionalCancel}
          onConfirm={handleFractionalConfirm}
        />
      )}
    </div>
  );
}
