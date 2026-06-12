import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Bug, PlusCircle } from 'lucide-react';
import Header from './Header';
import QuoteReviewTable from './QuoteReviewTable';
import type { QuoteLine, EditValues } from './QuoteReviewTable';
import ProductLookupModal, { type ProductResult } from './ProductLookupModal';
import { type SearchProduct } from './InlineProductSearch';
import AddLineModal, { type AddLineResult } from './quote/AddLineModal';
import { normalizeLines } from '../lib/normalizeLines';
import { useAppSettings } from '../hooks/useAppSettings';

interface QuoteData {
  status?: string;
  quoteReference: string;
  customerName: string;
  generatedDate: string;
  totalLines: number;
  currency: string;
  subtotal: number;
  lines: QuoteLine[];
}

const EMPTY_EDIT: EditValues = {
  matched_product_name: '',
  matched_product_code: '',
  matched_unit_price: '',
  quantity: '',
  matched_unit_of_measure: '',
};

interface QuoteReviewScreenProps {
  quoteData: QuoteData;
  editedQuoteData?: QuoteData | null;
  rawResponse: string;
  onApproved: (approvedLines: QuoteLine[], quoteData: QuoteData) => void;
  onBack: () => void;
}

type ViewMode = 'original' | 'edited';

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function QuoteReviewScreen({ quoteData, editedQuoteData, rawResponse, onApproved, onBack }: QuoteReviewScreenProps) {
  const { confidenceThreshold } = useAppSettings();

  const [viewMode, setViewMode] = useState<ViewMode>(editedQuoteData ? 'edited' : 'original');

  const activeQuoteData = viewMode === 'edited' && editedQuoteData ? editedQuoteData : quoteData;

  const [lines, setLines] = useState<QuoteLine[]>(normalizeLines(activeQuoteData?.lines) || []);
  const [subtotal, setSubtotal] = useState<number>(activeQuoteData?.subtotal || 0);

  useEffect(() => {
    const nextLines = normalizeLines(activeQuoteData?.lines) || [];
    setLines(nextLines);
    const total = nextLines.reduce((sum: number, l: any) => {
      if (l.ignored) return sum;
      return sum + (l.quantity || 0) * (l.matched_unit_price || 0);
    }, 0);
    setSubtotal(total);
  }, [viewMode, editedQuoteData, quoteData]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const editingIndexRef = useRef<number | null>(null);
  const [editValues, setEditValues] = useState<EditValues>(EMPTY_EDIT);
  const [showBackConfirm, setShowBackConfirm] = useState(false);
  const [debugExpanded, setDebugExpanded] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);
  const [showInlineAddRow, setShowInlineAddRow] = useState(false);
  const [showAddLineModal, setShowAddLineModal] = useState(false);
  const [replaceLineIndex, setReplaceLineIndex] = useState<number | null>(null);

  const isManualMode = activeQuoteData.status === 'manual';

  const linesWithReview = useMemo<QuoteLine[]>(() => {
    return lines.map((l: any) => ({
      ...l,
      needs_review: l.badgeType === 'manual' || l.badgeType === 'producto_nuevo'
        ? false
        : (l.confidence ?? 0) < confidenceThreshold,
    }));
  }, [lines, confidenceThreshold]);

  const flaggedCount = linesWithReview.filter(
    (l: any) => l.needs_review && !l.ignored && !l.approved
  ).length;
  const ignoredCount = linesWithReview.filter((l: any) => l.ignored).length;
  const formattedDebugJson = useMemo(() => {
    try {
      return JSON.stringify(JSON.parse(rawResponse), null, 2);
    } catch {
      return rawResponse;
    }
  }, [rawResponse]);

  const ensureEditedMode = useCallback(() => {
    if (editedQuoteData) setViewMode('edited');
  }, [editedQuoteData]);

  const recalculate = useCallback((updatedLines: QuoteLine[]) => {
    const total = updatedLines.reduce((sum, line) => {
      if (line.ignored) return sum;
      const lineTotal = (line.quantity || 0) * (line.matched_unit_price || 0);
      return sum + lineTotal;
    }, 0);
    setSubtotal(total);
  }, []);

  const handleProductSelect = useCallback((product: ProductResult) => {
    ensureEditedMode();
    const newLine: QuoteLine = {
      original_text: 'Agregado manualmente',
      quantity: 1,
      matched_unit_of_measure: product.UnitOfMeasure,
      description: product.ProductName,
      matched_product_code: product.ProductCode,
      matched_product_name: product.ProductName,
      matched_unit_price: product.UnitPrice,
      confidence: 1.0,
      match_reason: 'Agregado manualmente por el usuario',
      needs_review: false,
      alternative_product_code: null,
    } as any;
    const updatedLines = [...lines, newLine];
    setLines(updatedLines);
    recalculate(updatedLines);
    setShowProductModal(false);
  }, [lines, recalculate, ensureEditedMode]);

  const handleProductSelectInEdit = useCallback((product: SearchProduct) => {
    const idx = editingIndexRef.current ?? editingIndex;
    if (idx === null) return;
    ensureEditedMode();

    setLines(prev => {
      const updatedLines = [...prev];
      updatedLines[idx] = {
        ...updatedLines[idx],
        matched_product_code: product.CodigoArt,
        matched_product_name: product.DescCortaArt,
        matched_unit_price: Number(product.Precio),
        matched_unit_of_measure: product.UMP,
        confidence: 1.0,
        needs_review: false,
        approved: false,
      };
      setTimeout(() => recalculate(updatedLines), 0);
      return updatedLines;
    });

    editingIndexRef.current = null;
    setEditingIndex(null);
    setEditValues(EMPTY_EDIT);
  }, [editingIndex, recalculate, ensureEditedMode]);

  const handleInlineProductSelect = useCallback((product: SearchProduct) => {
    ensureEditedMode();
    const newLine: QuoteLine = {
      original_text: 'Agregado manualmente',
      quantity: 1,
      matched_unit_of_measure: product.UMP,
      matched_product_code: product.CodigoArt,
      matched_product_name: product.DescCortaArt,
      matched_unit_price: Number(product.Precio),
      confidence: 1.0,
      needs_review: false,
    };
    const updatedLines = [...lines, newLine];
    setLines(updatedLines);
    recalculate(updatedLines);
    setShowInlineAddRow(false);
  }, [lines, recalculate, ensureEditedMode]);

  const handleAddLineFromModal = useCallback((result: AddLineResult) => {
    ensureEditedMode();
    const newLine: QuoteLine = {
      original_text: 'Agregado manualmente',
      quantity: result.quantity,
      matched_unit_of_measure: result.matched_unit_of_measure,
      matched_product_code: result.matched_product_code,
      matched_product_name: result.matched_product_name,
      matched_unit_price: result.matched_unit_price,
      confidence: 1.0,
      needs_review: false,
      badgeType: result.source === 'producto_nuevo' ? 'producto_nuevo' : 'manual',
    };
    const updatedLines = [...lines, newLine];
    setLines(updatedLines);
    recalculate(updatedLines);
    setShowAddLineModal(false);
  }, [lines, recalculate, ensureEditedMode]);

  const handleReplaceLineFromModal = useCallback((result: AddLineResult) => {
    if (replaceLineIndex === null) return;
    ensureEditedMode();
    const updatedLines = [...lines];
    updatedLines[replaceLineIndex] = {
      ...updatedLines[replaceLineIndex],
      matched_product_code: result.matched_product_code,
      matched_product_name: result.matched_product_name,
      matched_unit_price: result.matched_unit_price,
      matched_unit_of_measure: result.matched_unit_of_measure,
      quantity: result.quantity,
      confidence: 1.0,
      needs_review: false,
      approved: false,
      badgeType: result.source === 'producto_nuevo' ? 'producto_nuevo' : 'manual',
    };
    setLines(updatedLines);
    recalculate(updatedLines);
    setReplaceLineIndex(null);
  }, [replaceLineIndex, lines, recalculate, ensureEditedMode]);

  const handleDeleteLine = useCallback((index: number) => {
    setDeleteConfirmIndex(index);
  }, []);

  const confirmDeleteLine = useCallback(() => {
    if (deleteConfirmIndex === null) return;
    ensureEditedMode();
    const updatedLines = lines.filter((_, i) => i !== deleteConfirmIndex);
    setLines(updatedLines);
    recalculate(updatedLines);
    setDeleteConfirmIndex(null);
  }, [deleteConfirmIndex, lines, recalculate, ensureEditedMode]);

  const handleQuantityChange = useCallback((index: number, newQty: number) => {
    ensureEditedMode();
    const updatedLines = [...lines];
    updatedLines[index] = { ...updatedLines[index], quantity: newQty };
    setLines(updatedLines);
    recalculate(updatedLines);
  }, [lines, recalculate, ensureEditedMode]);

  const handleEditStart = useCallback(
    (index: number) => {
      ensureEditedMode();
      const line = lines[index];
      editingIndexRef.current = index;
      setEditingIndex(index);
      setEditValues({
        matched_product_name: line.matched_product_name || '',
        matched_product_code: line.matched_product_code || '',
        matched_unit_price: line.matched_unit_price !== null ? String(line.matched_unit_price) : '',
        quantity: String(line.quantity ?? ''),
        matched_unit_of_measure: line.matched_unit_of_measure || '',
      });
    },
    [lines, ensureEditedMode]
  );

  const handleEditCancel = useCallback(() => {
    setEditingIndex(null);
    setEditValues(EMPTY_EDIT);
  }, []);

  const handleEditSave = useCallback(() => {
    if (editingIndex === null) return;
    ensureEditedMode();
    const updatedLines = [...lines];
    const parsedPrice = editValues.matched_unit_price !== '' ? parseFloat(editValues.matched_unit_price) : null;
    const parsedQtyRaw = editValues.quantity !== '' ? parseFloat(editValues.quantity) : 0;
    const parsedQty = isFinite(parsedQtyRaw) && parsedQtyRaw > 0 ? Math.max(1, Math.round(parsedQtyRaw)) : 1;
    updatedLines[editingIndex] = {
      ...updatedLines[editingIndex],
      matched_product_name: editValues.matched_product_name || null,
      matched_product_code: editValues.matched_product_code || null,
      matched_unit_price: parsedPrice !== null && !isNaN(parsedPrice) ? parsedPrice : null,
      quantity: parsedQty,
      matched_unit_of_measure: editValues.matched_unit_of_measure || '',
      needs_review: false,
    };
    setLines(updatedLines);
    recalculate(updatedLines);
    setEditingIndex(null);
    setEditValues(EMPTY_EDIT);
  }, [editingIndex, editValues, lines, recalculate, ensureEditedMode]);

  const handleEditChange = useCallback((field: keyof EditValues, value: string) => {
    setEditValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleIgnore = useCallback(
    (index: number) => {
      ensureEditedMode();
      const updatedLines = [...lines];
      updatedLines[index] = { ...updatedLines[index], ignored: true };
      setLines(updatedLines);
      recalculate(updatedLines);
    },
    [lines, recalculate, ensureEditedMode]
  );

  const handleRestore = useCallback(
    (index: number) => {
      ensureEditedMode();
      const updatedLines = [...lines];
      updatedLines[index] = { ...updatedLines[index], ignored: false };
      setLines(updatedLines);
      recalculate(updatedLines);
    },
    [lines, recalculate, ensureEditedMode]
  );

  const handleApprove = useCallback(
    (index: number) => {
      ensureEditedMode();
      const updatedLines = [...lines];
      updatedLines[index] = { ...updatedLines[index], approved: true };
      setLines(updatedLines);
      recalculate(updatedLines);
    },
    [lines, recalculate, ensureEditedMode]
  );

  const handleBack = useCallback(() => {
    setShowBackConfirm(true);
  }, []);

  const confirmBack = useCallback(() => {
    setShowBackConfirm(false);
    onBack();
  }, [onBack]);

  const canGeneratePDF = isManualMode ? lines.length > 0 : flaggedCount === 0;

  const handleGeneratePDF = useCallback(() => {
    if (!canGeneratePDF) return;
    const approvedLines = lines.filter((l) => !l.ignored);
    onApproved(approvedLines, { ...activeQuoteData, subtotal, lines: approvedLines, totalLines: approvedLines.length });
  }, [canGeneratePDF, lines, activeQuoteData, subtotal, onApproved]);

  const totalLinesCount = lines.filter((l) => !l.ignored).length;

  if (!quoteData) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', color: '#666' }}>
        <p>No hay datos de cotizacion disponibles. Regresa y sube un archivo.</p>
        <button onClick={onBack}>&larr; Volver a Carga</button>
      </div>
    );
  }

  if (!isManualMode && (!quoteData.lines || quoteData.lines.length === 0)) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', color: '#666' }}>
        <p>No se encontraron lineas de producto en los datos. Regresa e intenta de nuevo.</p>
        <button onClick={onBack}>&larr; Volver a Carga</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F3F3F3] flex flex-col" style={{ fontFamily: "'Manrope', sans-serif" }}>
      <Header hideHeader />

      {editedQuoteData && (
        <div className="w-full bg-white border-b border-[#E5E5E5] px-7 pt-3">
          <div className="max-w-[1480px] mx-auto flex gap-1">
            <button
              onClick={() => setViewMode('original')}
              className={`px-4 py-2.5 transition-colors border-b-2 ${
                viewMode === 'original'
                  ? 'border-[#0176D3] text-[#0176D3]'
                  : 'border-transparent text-[#747474] hover:text-[#181818]'
              }`}
              style={{ fontSize: 13, fontWeight: 600 }}
            >
              Version original
            </button>
            <button
              onClick={() => setViewMode('edited')}
              className={`px-4 py-2.5 transition-colors border-b-2 ${
                viewMode === 'edited'
                  ? 'border-[#0176D3] text-[#0176D3]'
                  : 'border-transparent text-[#747474] hover:text-[#181818]'
              }`}
              style={{ fontSize: 13, fontWeight: 600 }}
            >
              Version revisada
            </button>
          </div>
        </div>
      )}

      <div className="w-full bg-white border-b border-[#E5E5E5]">
        <div className="max-w-[1480px] mx-auto px-7 py-5 flex flex-wrap items-start gap-x-9 gap-y-3">
          <SummaryField label="Referencia" value={activeQuoteData.quoteReference} />
          <SummaryField label="Cliente" value={activeQuoteData.customerName} />
          <SummaryField label="Fecha" value={activeQuoteData.generatedDate} />
          <SummaryField label="Total de lineas" value={String(totalLinesCount)} />
          <div className="flex flex-col">
            <span
              className="uppercase text-[#747474]"
              style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em' }}
            >
              Por revisar
            </span>
            <span
              className="mt-1"
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: flaggedCount > 0 ? '#B86C00' : '#2E844A',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {flaggedCount}
            </span>
          </div>
          {ignoredCount > 0 && (
            <div className="flex flex-col">
              <span
                className="uppercase text-[#747474]"
                style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em' }}
              >
                Ignoradas
              </span>
              <span
                className="mt-1 text-[#A3A3A3]"
                style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
              >
                {ignoredCount}
              </span>
            </div>
          )}
          <SummaryField label="Subtotal" value={formatCurrency(subtotal, activeQuoteData.currency)} />
        </div>
      </div>

      {flaggedCount > 0 && (
        <div className="w-full bg-[#FEF1DC] border-b border-[#FECACA]">
          <div className="max-w-[1480px] mx-auto px-7 py-3 flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-[#B86C00] flex-shrink-0" />
            <p className="text-[#92400E]" style={{ fontSize: 13, fontWeight: 500 }}>
              {flaggedCount} {flaggedCount === 1 ? 'linea necesita' : 'lineas necesitan'} revision antes de generar el PDF.
              Revisa las filas resaltadas, editalas o ignoralas.
            </p>
          </div>
        </div>
      )}

      {isManualMode && (
        <div className="w-full bg-[#EAF5FE] border-b border-[#0176D3]/20">
          <div className="max-w-[1480px] mx-auto px-7 py-3 flex items-center gap-3">
            <PlusCircle className="w-4 h-4 text-[#0176D3] flex-shrink-0" />
            <p className="text-[#0176D3]" style={{ fontSize: 13, fontWeight: 500 }}>
              Modo cotizacion manual — Agrega productos con el boton debajo para armar la cotizacion desde cero.
            </p>
          </div>
        </div>
      )}

      <div className="flex-1 pt-5 bg-[#F3F3F3]">
        <div className="max-w-[1480px] mx-auto">
          {lines.length > 0 || showInlineAddRow ? (
            <QuoteReviewTable
              lines={linesWithReview}
              currency={activeQuoteData.currency}
              editingIndex={editingIndex}
              editValues={editValues}
              isManualMode={isManualMode}
              onEditStart={handleEditStart}
              onEditCancel={handleEditCancel}
              onEditSave={handleEditSave}
              onEditChange={handleEditChange}
              onIgnore={handleIgnore}
              onRestore={handleRestore}
              onDeleteLine={handleDeleteLine}
              onQuantityChange={handleQuantityChange}
              onProductSelect={handleProductSelectInEdit}
              onApprove={handleApprove}
              onReplaceLine={(index) => setReplaceLineIndex(index)}
              onAddLine={() => setShowAddLineModal(true)}
              showInlineAddRow={showInlineAddRow}
              onInlineAddProduct={handleInlineProductSelect}
              onCancelInlineAdd={() => setShowInlineAddRow(false)}
            />
          ) : (
            <div className="px-7 py-16 text-center">
              <div className="inline-flex flex-col items-center">
                <div className="w-14 h-14 rounded-full bg-[#EAF5FE] flex items-center justify-center mb-4">
                  <PlusCircle className="w-7 h-7 text-[#0176D3]" />
                </div>
                <p className="text-[#181818] mb-1" style={{ fontSize: 15, fontWeight: 600 }}>
                  Aun no hay lineas
                </p>
                <p className="text-[#747474] mb-4" style={{ fontSize: 13 }}>
                  Agrega productos para comenzar tu cotizacion.
                </p>
                <button
                  onClick={() => setShowAddLineModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 border border-[#0176D3] text-[#0176D3] rounded-lg hover:bg-[#EAF5FE] transition-colors bg-white"
                  style={{ fontSize: 13, fontWeight: 600 }}
                >
                  <PlusCircle className="w-4 h-4" />
                  + Agregar linea
                </button>
              </div>
            </div>
          )}

          {isManualMode && !showInlineAddRow && lines.length > 0 && (
            <div className="px-7 pb-4">
              <button
                onClick={() => setShowInlineAddRow(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 border border-[#0176D3] text-[#0176D3] rounded-lg hover:bg-[#EAF5FE] transition-colors bg-white"
                style={{ fontSize: 13, fontWeight: 600 }}
              >
                <PlusCircle className="w-4 h-4" />
                Agregar linea de producto
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-[#F3F3F3]">
        <div className="max-w-[1480px] mx-auto px-7 pt-6 pb-2 flex justify-end">
          <div className="w-72 border-t-2 border-[#E5E5E5] pt-4">
            <div className="flex justify-between items-center">
              <span className="text-[#747474]" style={{ fontSize: 13, fontWeight: 500 }}>
                Subtotal ({activeQuoteData.currency})
              </span>
              <span
                className="text-[#181818]"
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatCurrency(subtotal, activeQuoteData.currency)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#F3F3F3]">
        <div className="max-w-[1480px] mx-auto px-7 pt-4 pb-3 flex justify-end gap-3">
          <button
            onClick={handleBack}
            className="px-5 py-3 border border-[#E5E5E5] text-[#444444] rounded-lg hover:bg-white transition-colors"
            style={{ fontSize: 14, fontWeight: 600 }}
          >
            ← Volver a cargar
          </button>
          <div className="relative group">
            <button
              onClick={handleGeneratePDF}
              disabled={!canGeneratePDF}
              className={`px-7 py-3 rounded-lg transition-all flex items-center gap-2 ${
                canGeneratePDF
                  ? 'bg-[#0176D3] text-white hover:bg-[#014486]'
                  : 'bg-[#D1D5DB] text-[#747474] cursor-not-allowed'
              }`}
              style={{ fontSize: 14, fontWeight: 700 }}
            >
              Generar PDF →
            </button>
            {!canGeneratePDF && (
              <div
                className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-[#181818] text-white rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                style={{ fontSize: 11, fontWeight: 500 }}
              >
                {isManualMode ? 'Agrega al menos un producto' : 'Revisa todas las lineas marcadas antes de generar'}
                <div className="absolute top-full right-4 w-2 h-2 bg-[#181818] rotate-45 -translate-y-1"></div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-[#F3F3F3]">
        <div className="max-w-[1480px] mx-auto px-7 pb-6 text-center">
          <p className="text-[#747474]" style={{ fontSize: 12 }}>
            Todos los cambios se aplicaran al PDF final. La cotizacion se guardara en tu historial.
          </p>
        </div>
      </div>

      {!isManualMode && rawResponse && (
        <div className="bg-[#F3F3F3]">
          <div className="max-w-[1480px] mx-auto border-t border-[#E5E5E5] mx-7 mb-8">
            <button
              onClick={() => setDebugExpanded(!debugExpanded)}
              className="w-full flex items-center gap-2 py-4 text-left hover:bg-white transition-colors px-2"
            >
              <Bug className="w-4 h-4 text-[#747474]" />
              <span className="text-[#444444]" style={{ fontSize: 13, fontWeight: 600 }}>
                Debug: respuesta del API
              </span>
              {debugExpanded ? (
                <ChevronDown className="w-4 h-4 text-[#747474] ml-auto" />
              ) : (
                <ChevronRight className="w-4 h-4 text-[#747474] ml-auto" />
              )}
            </button>
            {debugExpanded && (
              <div
                className="rounded-lg overflow-hidden mb-4 border border-[#E5E5E5]"
                style={{ maxHeight: '400px', backgroundColor: '#0F172A' }}
              >
                <div className="overflow-auto h-full p-5" style={{ maxHeight: '400px' }}>
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
                    {formattedDebugJson}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {!isManualMode && (
        <ProductLookupModal
          open={showProductModal}
          onSelect={handleProductSelect}
          onClose={() => setShowProductModal(false)}
        />
      )}

      <AddLineModal
        open={showAddLineModal}
        onClose={() => setShowAddLineModal(false)}
        onLineAdded={handleAddLineFromModal}
        title="Agregar linea"
      />

      <AddLineModal
        open={replaceLineIndex !== null}
        onClose={() => setReplaceLineIndex(null)}
        onLineAdded={handleReplaceLineFromModal}
        title="Reemplazar producto"
        sourceLineData={replaceLineIndex !== null ? {
          originalText: lines[replaceLineIndex]?.original_text || '',
          quantity: lines[replaceLineIndex]?.quantity || 1,
          unitOfMeasure: lines[replaceLineIndex]?.matched_unit_of_measure || 'PZ',
        } : null}
      />

      {deleteConfirmIndex !== null && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div
            className="bg-white rounded-xl p-7 max-w-sm w-full mx-4 border border-[#E5E5E5]"
            style={{ boxShadow: '0 12px 24px rgba(0,0,0,.15)' }}
          >
            <h3
              className="text-[#181818] mb-2"
              style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em' }}
            >
              ¿Eliminar linea?
            </h3>
            <p className="text-[#444444] mb-6" style={{ fontSize: 13, lineHeight: 1.5 }}>
              Esta linea se quitara de la cotizacion. No podras deshacer esta accion.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirmIndex(null)}
                className="px-4 py-2 text-[#444444] bg-[#F0F0F0] rounded-lg hover:bg-[#E5E5E5] transition-colors"
                style={{ fontSize: 13, fontWeight: 600 }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteLine}
                className="px-4 py-2 text-white bg-[#BA0517] rounded-lg hover:bg-[#8E0410] transition-colors"
                style={{ fontSize: 13, fontWeight: 600 }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {showBackConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div
            className="bg-white rounded-xl p-7 max-w-sm w-full mx-4 border border-[#E5E5E5]"
            style={{ boxShadow: '0 12px 24px rgba(0,0,0,.15)' }}
          >
            <h3
              className="text-[#181818] mb-2"
              style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em' }}
            >
              ¿Salir de esta pagina?
            </h3>
            <p className="text-[#444444] mb-6" style={{ fontSize: 13, lineHeight: 1.5 }}>
              Si sales ahora, perderas todos los cambios que has hecho en esta cotizacion.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowBackConfirm(false)}
                className="px-4 py-2 text-[#444444] bg-[#F0F0F0] rounded-lg hover:bg-[#E5E5E5] transition-colors"
                style={{ fontSize: 13, fontWeight: 600 }}
              >
                Quedarme
              </button>
              <button
                onClick={confirmBack}
                className="px-4 py-2 text-white bg-[#BA0517] rounded-lg hover:bg-[#8E0410] transition-colors"
                style={{ fontSize: 13, fontWeight: 600 }}
              >
                Salir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span
        className="uppercase text-[#747474]"
        style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', fontFamily: "'Manrope', sans-serif" }}
      >
        {label}
      </span>
      <span
        className="text-[#181818] mt-1"
        style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Manrope', sans-serif" }}
      >
        {value}
      </span>
    </div>
  );
}
