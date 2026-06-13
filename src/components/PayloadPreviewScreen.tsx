import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { ArrowLeft, Send, ChevronDown, ChevronRight, Copy, Check, Table, Braces, AlertTriangle, Trash2, PlusCircle } from 'lucide-react';
import Header from './Header';
import { updateJobPayloadDebounced } from '../lib/jobs';
import { upsertJobLine, deleteJobLine as deleteJobLineApi } from '../lib/jobLines';

interface PayloadPreviewScreenProps {
  customerName: string;
  rows: Record<string, any>[];
  processingRules: string[];
  rawDoclingResponse?: any;
  notice?: string;
  jobReferencia?: string;
  jobId?: string;
  onConfirmSend: (editedRows: Record<string, any>[]) => void;
  onBack: () => void;
}

type ViewMode = 'table' | 'json';

export default function PayloadPreviewScreen({
  customerName,
  rows: initialRows,
  processingRules,
  rawDoclingResponse,
  notice,
  jobReferencia,
  jobId,
  onConfirmSend,
  onBack,
}: PayloadPreviewScreenProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [rulesExpanded, setRulesExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editableRows, setEditableRows] = useState<Record<string, any>[]>(() =>
    initialRows.map((r, i) => ({ ...r, 'IEST-01': String(i + 1), _lineIndex: i }))
  );
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const editableColumns = ['Codigo', 'Descripcion', 'Unid', 'Cant'];

  const allColumns = useMemo(() => {
    const colSet = new Set<string>();
    editableRows.forEach((row) => Object.keys(row).forEach((k) => colSet.add(k)));
    colSet.delete('_lineIndex');
    const cols = Array.from(colSet);
    const priority = ['IEST-01', 'Codigo', 'Descripcion', 'Unid', 'Cant'];
    return [
      ...priority.filter(c => cols.includes(c)),
      ...cols.filter(c => !priority.includes(c)),
    ];
  }, [editableRows]);

  const syncToSupabase = useCallback((rows: Record<string, any>[]) => {
    if (!jobReferencia) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateJobPayloadDebounced(jobReferencia, { rows }, rows.length);
    }, 1500);
  }, [jobReferencia]);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const renumber = (rows: Record<string, any>[]) =>
    rows.map((r, i) => ({ ...r, 'IEST-01': String(i + 1) }));

  const handleCellClick = (rowIdx: number, col: string) => {
    if (!editableColumns.includes(col)) return;
    setEditingCell({ row: rowIdx, col });
    setEditValue(String(editableRows[rowIdx][col] ?? ''));
  };

  const handleCellConfirm = () => {
    if (!editingCell) return;
    const { row, col } = editingCell;

    if (col === 'Cant') {
      const num = parseFloat(editValue);
      if (isNaN(num) || num <= 0) {
        setEditingCell(null);
        return;
      }
    }
    if (col === 'Descripcion' && !editValue.trim()) {
      setEditingCell(null);
      return;
    }

    const updated = [...editableRows];
    updated[row] = { ...updated[row], [col]: editValue };
    setEditableRows(updated);
    setEditingCell(null);
    syncToSupabase(updated);

    if (jobId) {
      const stableIdx = updated[row]._lineIndex;
      const r = updated[row];
      upsertJobLine(jobId, stableIdx, {
        codigo_original: r.Codigo || null,
        descripcion_original: r.Descripcion || null,
        unidad_original: r.Unid || null,
        cantidad: parseFloat(r.Cant) || 1,
      });
    }
  };

  const handleCellCancel = () => {
    setEditingCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCellConfirm();
    if (e.key === 'Escape') handleCellCancel();
  };

  const handleDeleteLine = (idx: number) => {
    setDeleteConfirm(idx);
  };

  const confirmDelete = () => {
    if (deleteConfirm === null) return;
    if (jobId) {
      const stableIdx = editableRows[deleteConfirm]._lineIndex;
      deleteJobLineApi(jobId, stableIdx);
    }
    const updated = renumber(editableRows.filter((_, i) => i !== deleteConfirm));
    setEditableRows(updated);
    setDeleteConfirm(null);
    syncToSupabase(updated);
  };

  const handleAddLine = () => {
    const maxLocalIdx = editableRows.reduce((max, r) => Math.max(max, r._lineIndex ?? 0), -1);
    const newLineIndex = maxLocalIdx + 1;
    const newRow: Record<string, any> = {};
    allColumns.forEach(col => { newRow[col] = ''; });
    newRow['IEST-01'] = String(editableRows.length + 1);
    newRow['Cant'] = '1';
    newRow['Unid'] = 'PZ';
    newRow['_lineIndex'] = newLineIndex;
    const updated = [...editableRows, newRow];
    setEditableRows(updated);
    syncToSupabase(updated);

    if (jobId) {
      upsertJobLine(jobId, newLineIndex, {
        codigo_original: null,
        descripcion_original: null,
        unidad_original: 'PZ',
        cantidad: 1,
        origen: 'auto',
        estado: 'pendiente',
        requiere_revision: false,
      });
    }

    setTimeout(() => {
      setEditingCell({ row: updated.length - 1, col: 'Descripcion' });
      setEditValue('');
    }, 50);
  };

  const jsonTabContent = useMemo(() => {
    const cleanRows = editableRows.map(({ _lineIndex, ...rest }) => rest);
    const editedPayload = rawDoclingResponse !== undefined && rawDoclingResponse !== null
      ? { ...rawDoclingResponse, rows: cleanRows }
      : { customerName, rows: cleanRows, processingRules };
    return JSON.stringify(editedPayload, null, 2);
  }, [rawDoclingResponse, editableRows, customerName, processingRules]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonTabContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard not available */ }
  };

  const handleConfirm = () => {
    const cleanRows = editableRows.map(({ _lineIndex, ...rest }) => rest);
    onConfirmSend(cleanRows);
  };

  return (
    <div className="min-h-screen bg-[#F3F3F3]" style={{ fontFamily: "'Manrope', sans-serif" }}>
      <Header hideHeader />

      <div className="max-w-[1100px] mx-auto px-7 py-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-[#747474] hover:text-[#0176D3] transition-colors mb-5 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span style={{ fontSize: 13, fontWeight: 600 }}>Volver a subir archivo</span>
        </button>

        <div className="mb-7">
          <h1
            className="text-[#181818] tracking-[-0.02em]"
            style={{ fontFamily: "'Manrope', sans-serif", fontSize: 28, fontWeight: 700, lineHeight: 1.15 }}
          >
            Revisar antes de procesar
          </h1>
          <p className="text-[#747474] mt-2 max-w-[640px]" style={{ fontSize: 14 }}>
            Verifica y edita los datos antes de enviarlos al orquestador. Haz clic en cualquier celda para editarla.
          </p>
        </div>

        {notice && (
          <div className="flex items-start gap-3 mb-6 px-4 py-3 rounded-lg border border-[#FCD34D] bg-[#FFFBEB]" role="status">
            <AlertTriangle className="w-5 h-5 text-[#B86C00] flex-shrink-0 mt-0.5" />
            <p className="text-[#7C4A03]" style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.5 }}>{notice}</p>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-[#E5E5E5] rounded-xl p-5" style={{ boxShadow: '0 1px 2px rgba(0,0,0,.05)' }}>
            <p className="uppercase mb-1.5 text-[#747474]" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em' }}>Cliente</p>
            <p className="text-[#181818] truncate" style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>{customerName}</p>
          </div>
          <div className="bg-white border border-[#E5E5E5] rounded-xl p-5" style={{ boxShadow: '0 1px 2px rgba(0,0,0,.05)' }}>
            <p className="uppercase mb-1.5 text-[#747474]" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em' }}>Filas detectadas</p>
            <p className="text-[#181818]" style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>{editableRows.length}</p>
          </div>
          <div className="bg-white border border-[#E5E5E5] rounded-xl p-5" style={{ boxShadow: '0 1px 2px rgba(0,0,0,.05)' }}>
            <p className="uppercase mb-1.5 text-[#747474]" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em' }}>Columnas</p>
            <p className="text-[#181818]" style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>{allColumns.length}</p>
          </div>
        </div>

        {/* Processing Rules */}
        <div className="bg-white border border-[#E5E5E5] rounded-xl mb-6 overflow-hidden" style={{ boxShadow: '0 1px 2px rgba(0,0,0,.05)' }}>
          <button
            onClick={() => setRulesExpanded(!rulesExpanded)}
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[#FAFAFA] transition-colors"
          >
            <span className="text-[#181818]" style={{ fontSize: 14, fontWeight: 600 }}>
              Reglas de procesamiento <span className="text-[#747474]" style={{ fontWeight: 500 }}>({processingRules.length})</span>
            </span>
            {rulesExpanded ? <ChevronDown className="w-4 h-4 text-[#747474]" /> : <ChevronRight className="w-4 h-4 text-[#747474]" />}
          </button>
          {rulesExpanded && (
            <div className="px-5 pb-4 border-t border-[#F0F0F0]">
              <ul className="mt-3 space-y-2.5">
                {processingRules.map((rule, i) => (
                  <li key={i} className="flex gap-3 text-[#444444]" style={{ fontSize: 13 }}>
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#EAF5FE] text-[#0176D3] flex items-center justify-center" style={{ fontSize: 11, fontWeight: 700 }}>{i + 1}</span>
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
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md transition-all ${viewMode === 'table' ? 'bg-white text-[#0176D3]' : 'text-[#444444] hover:text-[#181818]'}`}
              style={{ fontSize: 12, fontWeight: 600, boxShadow: viewMode === 'table' ? '0 1px 2px rgba(0,0,0,.06)' : 'none' }}
            >
              <Table className="w-3.5 h-3.5" />Tabla
            </button>
            <button
              onClick={() => setViewMode('json')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md transition-all ${viewMode === 'json' ? 'bg-white text-[#0176D3]' : 'text-[#444444] hover:text-[#181818]'}`}
              style={{ fontSize: 12, fontWeight: 600, boxShadow: viewMode === 'json' ? '0 1px 2px rgba(0,0,0,.06)' : 'none' }}
            >
              <Braces className="w-3.5 h-3.5" />JSON
            </button>
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3.5 py-2 text-[#444444] bg-white border border-[#E5E5E5] rounded-lg hover:bg-[#FAFAFA] hover:border-[#D1D5DB] transition-colors"
            style={{ fontSize: 12, fontWeight: 600 }}
          >
            {copied ? (<><Check className="w-3.5 h-3.5 text-[#2E844A]" /><span className="text-[#2E844A]">Copiado</span></>) : (<><Copy className="w-3.5 h-3.5" />Copiar JSON</>)}
          </button>
        </div>

        {/* Data view */}
        {viewMode === 'table' ? (
          <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden mb-4" style={{ boxShadow: '0 1px 2px rgba(0,0,0,.05)' }}>
            <div className="overflow-x-auto" style={{ maxHeight: '480px' }}>
              <table className="w-full" style={{ fontSize: 13 }}>
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[#FAFAFA] border-b border-[#E5E5E5]">
                    <th className="px-4 py-3 text-left uppercase text-[#747474]" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', width: 48 }}>#</th>
                    {allColumns.filter(c => c !== 'IEST-01').map((col) => (
                      <th key={col} className="px-4 py-3 text-left uppercase text-[#747474] whitespace-nowrap" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em' }}>
                        {col}
                        {editableColumns.includes(col) && <span className="ml-1 text-[#0176D3]" style={{ fontSize: 9 }}>(editable)</span>}
                      </th>
                    ))}
                    <th className="px-3 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F0F0]">
                  {editableRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-[#FAFBFC] transition-colors">
                      <td className="px-4 py-3 text-[#747474]" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{idx + 1}</td>
                      {allColumns.filter(c => c !== 'IEST-01').map((col) => {
                        const isEditing = editingCell?.row === idx && editingCell?.col === col;
                        const isEditableCol = editableColumns.includes(col);

                        if (isEditing) {
                          return (
                            <td key={col} className="px-2 py-1.5">
                              <input
                                type={col === 'Cant' ? 'number' : 'text'}
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={handleCellConfirm}
                                onKeyDown={handleKeyDown}
                                autoFocus
                                min={col === 'Cant' ? '1' : undefined}
                                className="w-full px-2 py-1.5 border border-[#0176D3] rounded-md text-[#181818] focus:outline-none focus:ring-[3px] focus:ring-[#EAF5FE]"
                                style={{ fontSize: 13 }}
                              />
                            </td>
                          );
                        }

                        return (
                          <td
                            key={col}
                            onClick={() => isEditableCol && handleCellClick(idx, col)}
                            className={`px-4 py-3 text-[#444444] whitespace-nowrap max-w-[300px] truncate ${isEditableCol ? 'cursor-pointer hover:bg-[#EAF5FE] rounded transition-colors' : ''}`}
                            title={String(row[col] ?? '')}
                          >
                            {row[col] ?? ''}
                          </td>
                        );
                      })}
                      <td className="px-2 py-3">
                        <button
                          onClick={() => handleDeleteLine(idx)}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[#A3A3A3] hover:text-[#BA0517] hover:bg-[#FEDED7] transition-colors"
                          title="Eliminar linea"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden mb-7 border border-[#E5E5E5]" style={{ maxHeight: '520px', boxShadow: '0 1px 2px rgba(0,0,0,.05)' }}>
            <div className="overflow-auto h-full" style={{ backgroundColor: '#0F172A', padding: '20px' }}>
              <pre style={{ color: '#E2E8F0', fontSize: '12px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace" }}>
                {jsonTabContent}
              </pre>
            </div>
          </div>
        )}

        {viewMode === 'table' && (
          <div className="mb-7">
            <button
              onClick={handleAddLine}
              className="inline-flex items-center gap-2 px-4 py-2 border border-[#0176D3] text-[#0176D3] rounded-lg hover:bg-[#EAF5FE] transition-colors bg-white"
              style={{ fontSize: 12, fontWeight: 600 }}
            >
              <PlusCircle className="w-4 h-4" />
              + Agregar linea
            </button>
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
            onClick={handleConfirm}
            className="flex items-center gap-2 px-6 py-3 text-white bg-[#0176D3] hover:bg-[#014486] rounded-lg transition-all"
            style={{ fontSize: 14, fontWeight: 700 }}
          >
            <Send className="w-4 h-4" />
            Confirmar y enviar a procesamiento
          </button>
        </div>
      </div>

      {/* Delete confirmation */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-7 max-w-sm w-full mx-4 border border-[#E5E5E5]" style={{ boxShadow: '0 12px 24px rgba(0,0,0,.15)' }}>
            <h3 className="text-[#181818] mb-2" style={{ fontSize: 17, fontWeight: 700 }}>¿Eliminar esta linea?</h3>
            <p className="text-[#444444] mb-6" style={{ fontSize: 13, lineHeight: 1.5 }}>
              La linea #{deleteConfirm + 1} se eliminara de la tabla. Las demas filas se renumeraran.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-[#444444] bg-[#F0F0F0] rounded-lg hover:bg-[#E5E5E5] transition-colors" style={{ fontSize: 13, fontWeight: 600 }}>Cancelar</button>
              <button onClick={confirmDelete} className="px-4 py-2 text-white bg-[#BA0517] rounded-lg hover:bg-[#8E0410] transition-colors" style={{ fontSize: 13, fontWeight: 600 }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
