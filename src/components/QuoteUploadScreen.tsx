import { useState, useCallback, useRef, DragEvent } from 'react';
import { Upload, Check, X, Lock, FileSpreadsheet, FileText, Image, Send } from 'lucide-react';
import * as mammoth from 'mammoth';
import Header from './Header';
import DebugPanel from './DebugPanel';
import { useDebugLogs } from '../hooks/useDebugLogs';
import FractionalQuantitiesDialog, {
  type FractionalRow,
  type FractionalDecision,
} from './FractionalQuantitiesDialog';
import processWithRailway from '../lib/processWithRailway';
import mapN8nToReviewData from '../lib/mapN8nToReviewData';

interface ParsedData {
  customerName: string;
  rows: any[];
  rawDoclingResponse?: any;
  mappingNotice?: string;
}

interface QuoteUploadScreenProps {
  readEngine?: 'default' | 'docling';
  onFileReady: (data: ParsedData) => void;
  onCreateManualQuote: (customerName: string) => void;
  onOpenAdmin?: () => void;
  onBackToHome?: () => void;
}

type ParseStatus = 'idle' | 'parsing' | 'processing' | 'success' | 'error';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const EXTRACT_API = `${SUPABASE_URL}/functions/v1/extract-products`;
const N8N_WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL || '';
const DOCLING_OCR_URL = 'https://cotizaciones-docling-production.up.railway.app/ocr';

async function callExtractFunction(body: Record<string, unknown>) {
  let response: Response;
  try {
    response = await fetch(EXTRACT_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_KEY}`,
        'apikey': ANON_KEY,
      },
      body: JSON.stringify(body),
    });
  } catch (fetchErr: any) {
    throw new Error(`Network error calling extract API: ${fetchErr?.message || String(fetchErr)}`);
  }
  const text = await response.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON response (${response.status}): ${text.substring(0, 300)}`);
  }
  if (!response.ok) {
    throw new Error(data?.error || `Server error (${response.status}): ${text.substring(0, 300)}`);
  }
  return data;
}

async function renderPdfToImages(pdf: any): Promise<{ base64: string; mediaType: string }[]> {
  const images: { base64: string; mediaType: string }[] = [];
  const maxPages = Math.min(pdf.numPages, 10);
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: ctx, viewport }).promise;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    images.push({ base64: dataUrl.split(',')[1], mediaType: 'image/jpeg' });
  }
  return images;
}

export default function QuoteUploadScreen({ readEngine = 'default', onFileReady, onCreateManualQuote, onOpenAdmin, onBackToHome }: QuoteUploadScreenProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [customerName, setCustomerName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [parseStatus, setParseStatus] = useState<ParseStatus>('idle');
  const [parseError, setParseError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [rowCount, setRowCount] = useState<number>(0);
  const [processingDetail, setProcessingDetail] = useState<string>('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [fractionalRows, setFractionalRows] = useState<FractionalRow[] | null>(null);
  const { logs, clearLogs } = useDebugLogs();

  const [n8nLoading, setN8nLoading] = useState(false);
  const [n8nError, setN8nError] = useState<string | null>(null);

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
    setProcessingDetail('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const extractProductsFromImage = useCallback(async (
    imageBase64: string,
    mediaType: string
  ) => {
    try {
      setParseStatus('processing');

      const data = await callExtractFunction({ imageBase64, mediaType });

      if (data?.error) {
        setParseError(data.error);
        setParseStatus('error');
        return;
      }

      const formattedRows = data?.data || [];

      if (formattedRows.length === 0) {
        setParseError('No se encontraron productos en la imagen. Verifica que la imagen contenga una lista clara de productos.');
        setParseStatus('error');
        return;
      }

      setParsedRows(formattedRows);
      setRowCount(formattedRows.length);
      setParseStatus('success');

      const fractional = detectFractionalRows(formattedRows);
      if (fractional.length > 0) {
        setFractionalRows(fractional);
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.error('[extractProductsFromImage] Error:', msg);
      setParseError(`Error al extraer productos: ${msg}`);
      setParseStatus('error');
    }
  }, []);

  const extractProductsFromImages = useCallback(async (
    images: { base64: string; mediaType: string }[]
  ) => {
    try {
      setParseStatus('processing');
      const allRows: any[] = [];
      for (let p = 0; p < images.length; p++) {
        setProcessingDetail(`Leyendo página ${p + 1} de ${images.length}…`);
        try {
          const data = await callExtractFunction({ imageBase64: images[p].base64, mediaType: images[p].mediaType });
          const rows = data?.data || [];
          if (Array.isArray(rows)) allRows.push(...rows);
        } catch (pageErr) {
          console.error('[extractProductsFromImages] page error:', pageErr);
        }
      }

      if (allRows.length === 0) {
        setParseError('No se encontraron productos en el PDF escaneado. Revisa que las páginas muestren una lista legible de productos.');
        setParseStatus('error');
        return;
      }

      const renumbered = allRows.map((row, i) => ({ ...row, 'IEST-01': String(i + 1) }));
      setParsedRows(renumbered);
      setRowCount(renumbered.length);
      setParseStatus('success');

      const fractional = detectFractionalRows(renumbered);
      if (fractional.length > 0) setFractionalRows(fractional);
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.error('[extractProductsFromImages] Error:', msg);
      setParseError(`Error al extraer productos: ${msg}`);
      setParseStatus('error');
    }
  }, []);

  const extractProductsFromText = useCallback(async (
    text: string,
    sourceType: string
  ) => {
    try {
      setParseStatus('processing');
      setProcessingDetail('');

      const allLinesRaw = text.split('\n').map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim() !== '');
      if (allLinesRaw.length === 0) {
        setParseError('El documento está vacío.');
        setParseStatus('error');
        return;
      }

      const headerKeywords = ['descrip', 'codigo', 'código', 'clave', 'cantidad', 'cant', 'unidad', 'precio', 'marca', 'sku', 'reng', 'partida', 'articulo', 'artículo', 'producto', 'modelo', 'ref'];
      const firstLower = allLinesRaw[0].toLowerCase();
      const matchCount = headerKeywords.filter((k) => firstLower.includes(k)).length;
      const hasHeader = matchCount >= 2 && !/\d{4,}/.test(allLinesRaw[0]);
      const header = hasHeader ? allLinesRaw[0] : null;
      const dataLines = hasHeader ? allLinesRaw.slice(1) : allLinesRaw;

      const CHUNK_SIZE = 40;
      const chunks: string[][] = [];
      for (let i = 0; i < dataLines.length; i += CHUNK_SIZE) {
        chunks.push(dataLines.slice(i, i + CHUNK_SIZE));
      }

      const allRows: any[] = [];
      for (let c = 0; c < chunks.length; c++) {
        if (chunks.length > 1) {
          setProcessingDetail(`Analizando lote ${c + 1} de ${chunks.length}…`);
        }
        const chunkText = (header ? header + '\n' : '') + chunks[c].join('\n');
        try {
          const data = await callExtractFunction({ text: chunkText, sourceType });
          const rows = data?.data || [];
          if (Array.isArray(rows)) allRows.push(...rows);
        } catch (chunkErr) {
          console.error('[extractProductsFromText] chunk error:', chunkErr);
        }
      }

      if (allRows.length === 0) {
        setParseError('No se encontraron productos en el documento. Verifica que el archivo contenga una tabla clara con productos, cantidades y descripciones.');
        setParseStatus('error');
        return;
      }

      const renumbered = allRows.map((row, i) => ({ ...row, 'IEST-01': String(i + 1) }));

      setParsedRows(renumbered);
      setRowCount(renumbered.length);
      setParseStatus('success');

      const fractional = detectFractionalRows(renumbered);
      if (fractional.length > 0) setFractionalRows(fractional);
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.error('[extractProductsFromText] Error:', msg);
      setParseError(`Error al extraer productos: ${msg}`);
      setParseStatus('error');
    }
  }, []);

  const parseExcel = useCallback(async (arrayBuffer: ArrayBuffer) => {
    try {
      const XLSX = (window as any).XLSX;
      const data = new Uint8Array(arrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });

      const allLines: string[] = [];

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;

        const rows = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: '',
          blankrows: false,
          raw: false,
        }) as any[][];

        const nonEmptyRows = rows.filter((row: any[]) =>
          row.some((cell: any) => cell !== null && cell !== undefined && String(cell).trim() !== '')
        );

        if (nonEmptyRows.length === 0) continue;

        for (const row of nonEmptyRows) {
          allLines.push(row.map((cell: any) => String(cell).trim()).join('\t'));
        }
      }

      const csvText = allLines.join('\n').trim();

      if (!csvText || csvText.length === 0) {
        setParseError('El archivo Excel parece estar vacío.');
        setParseStatus('error');
        return;
      }

      await extractProductsFromText(csvText, 'xlsx');
    } catch (err) {
      setParseError('⚠ No se pudo leer el archivo Excel. Revisa el formato.');
      setParseStatus('error');
    }
  }, [extractProductsFromText]);

  const parsePDF = useCallback(async (arrayBuffer: ArrayBuffer) => {
    try {
      const pdfjsLib = (window as any).pdfjsLib;
      if (!pdfjsLib) {
        setParseError('La librería de PDF no está disponible. Recarga la página e intenta de nuevo.');
        setParseStatus('error');
        return;
      }
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      let fullText = '';

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();

        const lines: string[] = [];
        let currentLine = '';
        let lastY: number | null = null;

        for (const item of textContent.items) {
          if (typeof (item as any).str !== 'string') continue;
          const str: string = (item as any).str;
          const y: number = (item as any).transform?.[5] ?? 0;

          if (str.trim() === '') {
            if ((item as any).hasEOL) {
              if (currentLine.trim()) lines.push(currentLine.trim());
              currentLine = '';
              lastY = null;
            }
            continue;
          }

          if (lastY !== null && Math.abs(y - lastY) > 3) {
            if (currentLine.trim()) lines.push(currentLine.trim());
            currentLine = str + ' ';
          } else {
            currentLine += str + ' ';
          }
          lastY = y;
        }

        if (currentLine.trim()) lines.push(currentLine.trim());
        fullText += lines.join('\n') + '\n\n';
      }

      console.log('[parsePDF] Extracted text length:', fullText.trim().length);
      console.log('[parsePDF] Text preview:', fullText.trim().substring(0, 300));

      const trimmed = fullText.trim();
      const avgPerPage = pdf.numPages > 0 ? trimmed.length / pdf.numPages : trimmed.length;

      if (trimmed.length < 20 || avgPerPage < 15) {
        console.log('[parsePDF] PDF sin texto legible, usando OCR por imagen. avgPerPage =', avgPerPage);
        setParseStatus('processing');
        const images = await renderPdfToImages(pdf);
        await extractProductsFromImages(images);
        return;
      }

      await extractProductsFromText(trimmed, 'pdf');
    } catch (err) {
      console.error('[parsePDF] Error:', err);
      setParseError(
        'No se pudo leer el PDF. Asegúrate de que el archivo no esté protegido o escaneado.'
      );
      setParseStatus('error');
    }
  }, [extractProductsFromText, extractProductsFromImages]);

  const parseWord = useCallback(async (arrayBuffer: ArrayBuffer) => {
    try {
      const result = await mammoth.extractRawText({
        arrayBuffer
      });
      const text = result.value;

      if (!text || text.trim().length === 0) {
        setParseError(
          'El documento Word parece estar vacío.'
        );
        setParseStatus('error');
        return;
      }

      await extractProductsFromText(text, 'docx');
    } catch (err) {
      setParseError(
        'No se pudo leer el documento Word.'
      );
      setParseStatus('error');
    }
  }, [extractProductsFromText]);

  const parsePlainText = useCallback(async (arrayBuffer: ArrayBuffer) => {
    try {
      const decoder = new TextDecoder('utf-8');
      const text = decoder.decode(arrayBuffer);

      if (!text || text.trim().length === 0) {
        setParseError('El archivo de texto está vacío.');
        setParseStatus('error');
        return;
      }

      await extractProductsFromText(text, 'txt');
    } catch (err) {
      setParseError('No se pudo leer el archivo de texto.');
      setParseStatus('error');
    }
  }, [extractProductsFromText]);

  const parseImage = useCallback(async (file: File) => {
    try {
      const mediaType = file.type || 'image/jpeg';
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        const base64 = dataUrl.split(',')[1];
        extractProductsFromImage(base64, mediaType);
      };
      reader.onerror = () => {
        setParseError('No se pudo leer la imagen.');
        setParseStatus('error');
      };
      reader.readAsDataURL(file);
    } catch {
      setParseError('No se pudo procesar la imagen.');
      setParseStatus('error');
    }
  }, [extractProductsFromImage]);

  const processFile = useCallback((file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    const imageExtensions = ['png', 'jpg', 'jpeg', 'webp', 'gif'];

    if (!extension || !['xlsx', 'xls', 'pdf', 'docx', 'doc', 'txt', ...imageExtensions].includes(extension)) {
      setParseError('Formato de archivo no soportado.');
      setSelectedFile(null);
      setParseStatus('error');
      return;
    }

    setSelectedFile(file);
    setParseError(null);

    if (readEngine === 'docling') {
      setParsedRows([]);
      setRowCount(0);
      setParseStatus('success');
      return;
    }

    setParseStatus('parsing');

    if (imageExtensions.includes(extension)) {
      parseImage(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const arrayBuffer = event.target?.result as ArrayBuffer;

      if (extension === 'xlsx' || extension === 'xls') {
        parseExcel(arrayBuffer);
      } else if (extension === 'pdf') {
        parsePDF(arrayBuffer);
      } else if (extension === 'docx' || extension === 'doc') {
        parseWord(arrayBuffer);
      } else if (extension === 'txt') {
        parsePlainText(arrayBuffer);
      }
    };

    reader.onerror = () => {
      setParseError('⚠ Could not read file. Please try again.');
      setParseStatus('error');
    };

    reader.readAsArrayBuffer(file);
  }, [readEngine, parseExcel, parsePDF, parseWord, parsePlainText, parseImage]);

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'xlsx':
      case 'xls':
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
      case 'gif':
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
    setProcessingDetail('');
    setN8nError(null);
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

    if (readEngine === 'docling') {
      if (!selectedFile) return;
      setParseStatus('processing');
      setProcessingDetail('Enviando archivo a Docling (Railway)…');
      setParseError(null);
      try {
        const result = await processWithRailway(selectedFile);
        setProcessingDetail('');
        const notice = result.mappingSuccessful
          ? undefined
          : 'No se pudo mapear automáticamente a la tabla; revisa la pestaña JSON.';
        if (!result.mappingSuccessful) {
          console.warn('[Docling] Mapping not successful — passing empty rows + raw JSON.');
        }
        onFileReady({
          customerName: customerName.trim(),
          rows: result.mappedRows,
          rawDoclingResponse: result.rawResponse,
          mappingNotice: notice,
        });
      } catch (err: any) {
        const msg = err?.message || String(err);
        console.error('[Docling] Error:', msg);
        setParseError(msg);
        setParseStatus('error');
        setProcessingDetail('');
      }
      return;
    }

    if (parsedRows.length === 0) return;
    onFileReady({
      customerName: customerName.trim(),
      rows: parsedRows,
    });
  };

  const isButtonEnabled =
    customerName.trim() !== '' &&
    parseStatus !== 'processing' &&
    parseStatus !== 'parsing' &&
    (readEngine === 'docling'
      ? !!selectedFile && parseStatus !== 'error'
      : parseStatus === 'success');

  const isN8nButtonEnabled = !!selectedFile && !n8nLoading && parseStatus !== 'parsing' && parseStatus !== 'processing';

  const handleSendToN8n = async () => {
    if (!selectedFile) return;

    if (!N8N_WEBHOOK_URL) {
      const msg = 'VITE_N8N_WEBHOOK_URL no está configurada. Agrega la URL del webhook en el archivo .env y reinicia el servidor.';
      console.error('[n8n] Error:', msg);
      setN8nError(msg);
      return;
    }

    setN8nLoading(true);
    setN8nError(null);

    try {
      // Step A: Send file to Docling
      console.log('[n8n] Step A: Enviando archivo a Docling…', selectedFile.name, selectedFile.size);
      const form = new FormData();
      form.append('file', selectedFile);

      let doclingResponse: Response;
      try {
        doclingResponse = await fetch(DOCLING_OCR_URL, {
          method: 'POST',
          body: form,
        });
      } catch (fetchErr: any) {
        const detail = fetchErr?.message || String(fetchErr);
        throw new Error('No se pudo conectar a Docling (Railway). Posible causa: CORS o servicio caído. Detalle: ' + detail);
      }

      const doclingRawText = await doclingResponse.text();
      console.log('[n8n] Docling HTTP status:', doclingResponse.status);
      console.log('[n8n] Docling Content-Type:', doclingResponse.headers.get('content-type'));
      console.log('[n8n] Docling response:', doclingRawText);

      if (!doclingResponse.ok) {
        throw new Error(`Docling respondió HTTP ${doclingResponse.status}: ${doclingRawText.substring(0, 300)}`);
      }

      let doclingJson: any;
      try {
        doclingJson = JSON.parse(doclingRawText);
      } catch {
        throw new Error('La respuesta de Docling no es JSON válido: ' + doclingRawText.substring(0, 200));
      }

      // Step B: Send Docling JSON to n8n
      console.log('[n8n] Step B: Enviando JSON de Docling a n8n…');
      console.log('[n8n] Webhook URL:', N8N_WEBHOOK_URL);
      console.log('[n8n] Payload:', JSON.stringify(doclingJson));

      let n8nResponse: Response;
      try {
        n8nResponse = await fetch(N8N_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(doclingJson),
        });
      } catch (fetchErr: any) {
        const detail = fetchErr?.message || String(fetchErr);
        throw new Error('No se pudo conectar al webhook de n8n. Detalle: ' + detail);
      }

      const n8nRawText = await n8nResponse.text();
      console.log('[n8n] n8n HTTP status:', n8nResponse.status);
      console.log('[n8n] n8n Content-Type:', n8nResponse.headers.get('content-type'));
      console.log('[n8n] n8n raw response:', n8nRawText);

      if (!n8nResponse.ok) {
        throw new Error(`n8n respondió HTTP ${n8nResponse.status}: ${n8nRawText.substring(0, 300)}`);
      }

      let n8nData: any;
      try {
        n8nData = JSON.parse(n8nRawText);
      } catch {
        throw new Error('La respuesta de n8n no es JSON válido: ' + n8nRawText.substring(0, 200));
      }

      // Step C: Map and navigate
      const { mappedRows, mappingSuccessful } = mapN8nToReviewData(n8nData);
      console.log('[n8n] Mapping result:', mappingSuccessful ? `${mappedRows.length} rows` : 'mapping failed');

      const notice = mappingSuccessful
        ? undefined
        : 'No se pudo mapear automáticamente la respuesta de n8n a la tabla; revisa la pestaña JSON.';

      onFileReady({
        customerName: customerName.trim() || 'Sin cliente',
        rows: mappedRows,
        rawDoclingResponse: n8nData,
        mappingNotice: notice,
      });
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.error('[n8n] Error:', msg);
      setN8nError(msg);
    } finally {
      setN8nLoading(false);
    }
  };

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
              <input
                type="text"
                value={customerName}
                onChange={(e) => { setCustomerName(e.target.value); setManualError(null); }}
                placeholder="ej. Constructora del Norte – OC-2024-0091"
                className="w-full px-3.5 py-3 border border-[#E5E5E5] rounded-lg text-[#181818] placeholder:text-[#A3A3A3] focus:outline-none focus:border-[#0176D3] focus:ring-[3px] focus:ring-[#EAF5FE] transition-all"
                style={{ fontSize: 14 }}
              />
              <p className="mt-1.5 text-[#747474]" style={{ fontSize: 12 }}>
                Aparecerá como identificador de la cotización.
              </p>
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
              {!selectedFile && (
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
                    accept=".xlsx,.xls,.pdf,.docx,.doc,.txt,.png,.jpg,.jpeg,.webp,.gif"
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
                      Formatos soportados: PDF, XLSX, XLS, DOCX, TXT, PNG, JPG, WEBP · Máx. 20 MB
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
                    {(parseStatus === 'parsing' || parseStatus === 'processing') && (
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
                    {parseStatus !== 'parsing' && parseStatus !== 'processing' && (
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

              {/* Parse Status Messages */}
              <div className="mt-3 min-h-[20px]">
                {parseStatus === 'parsing' && (
                  <div className="flex items-center gap-2 text-[#747474]" style={{ fontSize: 13 }}>
                    <div className="w-4 h-4 border-2 border-[#0176D3] border-t-transparent rounded-full animate-spin"></div>
                    <span>Leyendo archivo…</span>
                  </div>
                )}
                {parseStatus === 'processing' && (
                  <div className="flex items-center gap-2.5 text-[#0176D3]" style={{ fontSize: 13 }}>
                    <div className="w-4 h-4 border-2 border-[#0176D3] border-t-transparent rounded-full animate-spin"></div>
                    <div className="flex flex-col gap-0">
                      <span style={{ fontWeight: 600 }}>Analizando con IA…</span>
                      <span className="text-[#747474]" style={{ fontSize: 12 }}>
                        {processingDetail
                          ? processingDetail
                          : selectedFile && ['png','jpg','jpeg','webp','gif'].includes(selectedFile.name.split('.').pop()?.toLowerCase() || '')
                          ? 'Leyendo imagen y extrayendo productos…'
                          : 'Extrayendo productos del archivo…'}
                      </span>
                    </div>
                  </div>
                )}
                {parseStatus === 'success' && (
                  <div className="flex items-center gap-2 text-[#2E844A]" style={{ fontSize: 13, fontWeight: 600 }}>
                    <Check className="w-4 h-4" />
                    {readEngine === 'docling' ? (
                      <span>Archivo listo. Se enviará a Docling al confirmar.</span>
                    ) : (
                      <span>{rowCount} {rowCount === 1 ? 'fila detectada' : 'filas detectadas'}</span>
                    )}
                  </div>
                )}
                {parseStatus === 'error' && (
                  <div className="text-[#B86C00]" style={{ fontSize: 13, fontWeight: 600 }}>
                    {parseError || 'No pudimos leer el archivo. Verifica el formato.'}
                  </div>
                )}
              </div>
            </div>

            {/* n8n Send Button */}
            {selectedFile && (
              <div className="mt-4">
                <button
                  onClick={handleSendToN8n}
                  disabled={!isN8nButtonEnabled}
                  className={`
                    w-full h-11 rounded-lg border transition-all flex items-center justify-center gap-2
                    ${isN8nButtonEnabled
                      ? 'border-[#0176D3] text-[#0176D3] bg-white hover:bg-[#EAF5FE] cursor-pointer'
                      : 'border-[#D1D5DB] text-[#A3A3A3] bg-[#FAFAFA] cursor-not-allowed'
                    }
                  `}
                  style={{ fontSize: 13, fontWeight: 700 }}
                >
                  {n8nLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-[#0176D3] border-t-transparent rounded-full animate-spin"></div>
                      Procesando vía n8n…
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Enviar a n8n
                    </>
                  )}
                </button>
                {n8nError && (
                  <p className="mt-2 text-[#B86C00]" style={{ fontSize: 12, fontWeight: 600 }}>
                    {n8nError}
                  </p>
                )}
              </div>
            )}

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
              Procesar y enviar
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
