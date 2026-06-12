import { useState, useMemo } from 'react';
import { ArrowLeft, Send, ChevronDown, ChevronRight, Copy, Check, Table, Braces, AlertTriangle } from 'lucide-react';
import Header from './Header';

interface PayloadPreviewScreenProps {
  customerName: string;
  rows: Record<string, any>[];
  processingRules: string[];
  rawDoclingResponse?: any;
  notice?: string;
  onConfirmSend: () => void;
  onBack: () => void;
}

type ViewMode = 'table' | 'json';

export default function PayloadPreviewScreen({
  customerName,
  rows,
  processingRules,
  rawDoclingResponse,
  notice,
  onConfirmSend,
  onBack,
}: PayloadPreviewScreenProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [rulesExpanded, setRulesExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const fullPayload = useMemo(
    () => ({ customerName, rows, processingRules }),
    [customerName, rows, processingRules]
  );

  const allColumns = useMemo(() => {
    const colSet = new Set<string>();
    rows.forEach((row) => Object.keys(row).forEach((k) => colSet.add(k)));
    return Array.from(colSet);
  }, [rows]);

  const jsonTabContent = useMemo(
    () =>
      rawDoclingResponse !== undefined && rawDoclingResponse !== null
        ? typeof rawDoclingResponse === 'string'
          ? rawDoclingResponse
          : JSON.stringify(rawDoclingResponse, null, 2)
        : JSON.stringify(fullPayload, null, 2),
    [rawDoclingResponse, fullPayload]
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonTabContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  };

  return (
    <div className="min-h-screen bg-[#F3F3F3]" style={{ fontFamily: "'Manrope', sans-serif" }}>
      <Header hideHeader />

      <div className="max-w-[1100px] mx-auto px-7 py-6">
        {/* Back button */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-[#747474] hover:text-[#0176D3] transition-colors mb-5 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span style={{ fontSize: 13, fontWeight: 600 }}>Volver a subir archivo</span>
        </button>

        {/* Title */}
        <div className="mb-7">
          <h1
            className="text-[#181818] tracking-[-0.02em]"
            style={{ fontFamily: "'Manrope', sans-serif", fontSize: 28, fontWeight: 700, lineHeight: 1.15 }}
          >
            Revisar antes de procesar
          </h1>
          <p className="text-[#747474] mt-2 max-w-[640px]" style={{ fontSize: 14 }}>
            Verifica los datos que vamos a enviar al orquestador. Si algo se ve mal, regresa y vuelve a subir el archivo.
          </p>
        </div>

        {notice && (
          <div
            className="flex items-start gap-3 mb-6 px-4 py-3 rounded-lg border border-[#FCD34D] bg-[#FFFBEB]"
            role="status"
          >
            <AlertTriangle className="w-5 h-5 text-[#B86C00] flex-shrink-0 mt-0.5" />
            <p className="text-[#7C4A03]" style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.5 }}>
              {notice}
            </p>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-[#E5E5E5] rounded-xl p-5"
               style={{ boxShadow: '0 1px 2px rgba(0,0,0,.05)' }}>
            <p className="uppercase mb-1.5 text-[#747474]"
               style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em' }}>
              Cliente
            </p>
            <p className="text-[#181818] truncate" style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>
              {customerName}
            </p>
          </div>
          <div className="bg-white border border-[#E5E5E5] rounded-xl p-5"
               style={{ boxShadow: '0 1px 2px rgba(0,0,0,.05)' }}>
            <p className="uppercase mb-1.5 text-[#747474]"
               style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em' }}>
              Filas detectadas
            </p>
            <p className="text-[#181818]" style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>
              {rows.length}
            </p>
          </div>
          <div className="bg-white border border-[#E5E5E5] rounded-xl p-5"
               style={{ boxShadow: '0 1px 2px rgba(0,0,0,.05)' }}>
            <p className="uppercase mb-1.5 text-[#747474]"
               style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em' }}>
              Columnas
            </p>
            <p className="text-[#181818]" style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>
              {allColumns.length}
            </p>
          </div>
        </div>

        {/* Processing Rules (collapsible) */}
        <div className="bg-white border border-[#E5E5E5] rounded-xl mb-6 overflow-hidden"
             style={{ boxShadow: '0 1px 2px rgba(0,0,0,.05)' }}>
          <button
            onClick={() => setRulesExpanded(!rulesExpanded)}
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[#FAFAFA] transition-colors"
          >
            <span className="text-[#181818]" style={{ fontSize: 14, fontWeight: 600 }}>
              Reglas de procesamiento <span className="text-[#747474]" style={{ fontWeight: 500 }}>({processingRules.length})</span>
            </span>
            {rulesExpanded ? (
              <ChevronDown className="w-4 h-4 text-[#747474]" />
            ) : (
              <ChevronRight className="w-4 h-4 text-[#747474]" />
            )}
          </button>
          {rulesExpanded && (
            <div className="px-5 pb-4 border-t border-[#F0F0F0]">
              <ul className="mt-3 space-y-2.5">
                {processingRules.map((rule, i) => (
                  <li key={i} className="flex gap-3 text-[#444444]" style={{ fontSize: 13 }}>
                    <span
                      className="flex-shrink-0 w-5 h-5 rounded-full bg-[#EAF5FE] text-[#0176D3] flex items-center justify-center"
                      style={{ fontSize: 11, fontWeight: 700 }}
                    >
                      {i + 1}
                    </span>
                    <span className="leading-relaxed">{rule}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* View toggle + copy */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center bg-[#F0F0F0] p-1 rounded-lg gap-1">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md transition-all ${
                viewMode === 'table'
                  ? 'bg-white text-[#0176D3]'
                  : 'text-[#444444] hover:text-[#181818]'
              }`}
              style={{
                fontSize: 12,
                fontWeight: 600,
                boxShadow: viewMode === 'table' ? '0 1px 2px rgba(0,0,0,.06)' : 'none',
              }}
            >
              <Table className="w-3.5 h-3.5" />
              Tabla
            </button>
            <button
              onClick={() => setViewMode('json')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md transition-all ${
                viewMode === 'json'
                  ? 'bg-white text-[#0176D3]'
                  : 'text-[#444444] hover:text-[#181818]'
              }`}
              style={{
                fontSize: 12,
                fontWeight: 600,
                boxShadow: viewMode === 'json' ? '0 1px 2px rgba(0,0,0,.06)' : 'none',
              }}
            >
              <Braces className="w-3.5 h-3.5" />
              JSON
            </button>
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3.5 py-2 text-[#444444] bg-white border border-[#E5E5E5] rounded-lg hover:bg-[#FAFAFA] hover:border-[#D1D5DB] transition-colors"
            style={{ fontSize: 12, fontWeight: 600 }}
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#2E844A]" />
                <span className="text-[#2E844A]">Copiado</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copiar JSON
              </>
            )}
          </button>
        </div>

        {/* Data view */}
        {viewMode === 'table' ? (
          <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden mb-7"
               style={{ boxShadow: '0 1px 2px rgba(0,0,0,.05)' }}>
            <div className="overflow-x-auto" style={{ maxHeight: '480px' }}>
              <table className="w-full" style={{ fontSize: 13 }}>
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[#FAFAFA] border-b border-[#E5E5E5]">
                    <th
                      className="px-4 py-3 text-left uppercase text-[#747474]"
                      style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', width: 48 }}
                    >
                      #
                    </th>
                    {allColumns.map((col) => (
                      <th
                        key={col}
                        className="px-4 py-3 text-left uppercase text-[#747474] whitespace-nowrap"
                        style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em' }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F0F0]">
                  {rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-[#FAFBFC] transition-colors">
                      <td
                        className="px-4 py-3 text-[#747474]"
                        style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}
                      >
                        {idx + 1}
                      </td>
                      {allColumns.map((col) => (
                        <td
                          key={col}
                          className="px-4 py-3 text-[#444444] whitespace-nowrap max-w-[300px] truncate"
                          title={String(row[col] ?? '')}
                        >
                          {row[col] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden mb-7 border border-[#E5E5E5]"
               style={{ maxHeight: '520px', boxShadow: '0 1px 2px rgba(0,0,0,.05)' }}>
            <div className="overflow-auto h-full" style={{ backgroundColor: '#0F172A', padding: '20px' }}>
              <pre
                style={{
                  color: '#E2E8F0',
                  fontSize: '12px',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  margin: 0,
                  fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
                }}
              >
                {jsonTabContent}
              </pre>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <button
            onClick={onBack}
            className="px-5 py-3 text-[#444444] bg-white border border-[#E5E5E5] rounded-lg hover:bg-[#FAFAFA] transition-colors"
            style={{ fontSize: 14, fontWeight: 600 }}
          >
            Volver
          </button>
          <button
            onClick={onConfirmSend}
            className="flex items-center gap-2 px-6 py-3 text-white bg-[#0176D3] hover:bg-[#014486] rounded-lg transition-all"
            style={{ fontSize: 14, fontWeight: 700 }}
          >
            <Send className="w-4 h-4" />
            Confirmar y enviar a procesamiento
          </button>
        </div>
      </div>
    </div>
  );
}
