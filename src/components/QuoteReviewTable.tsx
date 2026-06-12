import { Pencil, XCircle, RotateCcw, X, Trash2, Check, PackagePlus, PlusCircle } from 'lucide-react';
import ConfidenceBadge from './ConfidenceBadge';
import InlineProductSearch, { type SearchProduct } from './InlineProductSearch';
import InlineProductLineRow from './InlineProductLineRow';

export interface QuoteLine {
  original_text: string;
  original_code?: string | null;
  matched_product_name: string | null;
  matched_product_code: string | null;
  confidence: number;
  quantity: number;
  matched_unit_of_measure: string;
  matched_unit_price: number | null;
  needs_review: boolean;
  ignored?: boolean;
  approved?: boolean;
  badgeType?: 'auto' | 'manual' | 'producto_nuevo';
}

export interface EditValues {
  matched_product_name: string;
  matched_product_code: string;
  matched_unit_price: string;
  quantity: string;
  matched_unit_of_measure: string;
}

interface QuoteReviewTableProps {
  lines: QuoteLine[];
  currency: string;
  editingIndex: number | null;
  editValues: EditValues;
  isManualMode?: boolean;
  onEditStart: (index: number) => void;
  onEditCancel: () => void;
  onEditSave: () => void;
  onEditChange: (field: keyof EditValues, value: string) => void;
  onIgnore: (index: number) => void;
  onRestore: (index: number) => void;
  onDeleteLine?: (index: number) => void;
  onQuantityChange?: (index: number, qty: number) => void;
  onProductSelect?: (product: SearchProduct) => void;
  onApprove?: (index: number) => void;
  onReplaceLine?: (index: number) => void;
  onAddLine?: () => void;
  showInlineAddRow?: boolean;
  onInlineAddProduct?: (product: SearchProduct) => void;
  onCancelInlineAdd?: () => void;
}

function formatCurrency(value: number | null, currency: string): string {
  if (value === null || value === undefined) return '\u2014';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function QuoteReviewTable({
  lines,
  currency,
  editingIndex,
  editValues,
  isManualMode = false,
  onEditStart,
  onEditCancel,
  onEditSave,
  onEditChange,
  onIgnore,
  onRestore,
  onDeleteLine,
  onQuantityChange,
  onProductSelect,
  onApprove,
  onReplaceLine,
  onAddLine,
  showInlineAddRow,
  onInlineAddProduct,
  onCancelInlineAdd,
}: QuoteReviewTableProps) {
  return (
    <div className="px-7 pb-4">
      <div
        className="bg-white border border-[#E5E5E5] rounded-xl overflow-hidden"
        style={{ boxShadow: '0 1px 2px rgba(0,0,0,.05)' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13 }}>
            <thead>
              <tr
                className="bg-[#FAFAFA] border-b border-[#E5E5E5] text-left text-[#747474]"
                style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}
              >
                <th className="py-3 px-4 w-12">#</th>
                <th className="py-3 px-4 min-w-[200px]">Solicitud original</th>
                <th className="py-3 px-4 min-w-[220px]">Producto encontrado</th>
                <th className="py-3 px-4 w-28 text-center">Confianza</th>
                <th className="py-3 px-4 w-16 text-center">Cant.</th>
                <th className="py-3 px-4 w-20 text-center">U.M.</th>
                <th className="py-3 px-4 w-28 text-right">Precio unit.</th>
                <th className="py-3 px-4 w-28 text-right">Total linea</th>
                <th className="py-3 px-4 w-36 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => {
                const isFlagged = line.needs_review;
                const isEditing = editingIndex === index;
                const lineTotal =
                  line.matched_unit_price !== null && line.matched_unit_price !== undefined
                    ? (line.quantity || 0) * line.matched_unit_price
                    : null;

                if (isEditing) {
                  return (
                    <tr
                      key={index}
                      className={`border-b border-[#F0F0F0] ${
                        isFlagged
                          ? 'bg-[#FEF1DC]'
                          : 'bg-[#EAF5FE]'
                      }`}
                      style={{
                        borderLeft: isFlagged ? '3px solid #B86C00' : '3px solid #0176D3',
                      }}
                    >
                      <td
                        className="py-4 px-4 align-top text-[#747474]"
                        style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600 }}
                      >
                        {index + 1}
                      </td>
                      <td className="py-4 px-4 align-top">
                        <div
                          className="text-[#444444] leading-relaxed"
                          style={{ fontSize: 12, fontStyle: 'italic' }}
                        >
                          {line.original_text}
                        </div>
                        {line.original_code && (
                          <div
                            className="text-[#747474] mt-0.5"
                            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}
                          >
                            {line.original_code}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4" colSpan={6}>
                        <div className="flex flex-wrap items-end gap-3">
                          <div className="flex-1 min-w-[240px]">
                            <label
                              className="block uppercase text-[#747474] mb-1.5"
                              style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em' }}
                            >
                              Buscar producto
                            </label>
                            <InlineProductSearch
                              placeholder="Nombre, codigo o marca..."
                              initialValue={line.matched_product_name || ''}
                              autoFocus={true}
                              onSelect={onProductSelect!}
                              onCancel={onEditCancel}
                            />
                          </div>
                          <div className="w-[90px]">
                            <label
                              className="block uppercase text-[#747474] mb-1.5"
                              style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em' }}
                            >
                              Cantidad
                            </label>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={editValues.quantity}
                              onChange={(e) => {
                                const raw = e.target.value;
                                if (raw === '') {
                                  onEditChange('quantity', '');
                                  return;
                                }
                                const parsed = parseInt(raw, 10);
                                if (!isNaN(parsed) && parsed > 0) {
                                  onEditChange('quantity', String(parsed));
                                }
                              }}
                              onBlur={(e) => {
                                const num = parseFloat(e.target.value);
                                if (!isFinite(num) || num <= 0) {
                                  onEditChange('quantity', '1');
                                  return;
                                }
                                if (!Number.isInteger(num)) {
                                  onEditChange('quantity', String(Math.round(num)));
                                }
                              }}
                              className="w-full px-3 py-2 border border-[#E5E5E5] rounded-md focus:outline-none focus:border-[#0176D3] focus:ring-[3px] focus:ring-[#EAF5FE] transition-all"
                              style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}
                            />
                          </div>
                          <div className="flex gap-2 pb-0.5">
                            <button
                              onClick={onEditSave}
                              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0176D3] text-white rounded-md hover:bg-[#014486] transition-colors"
                              style={{ fontSize: 13, fontWeight: 600 }}
                            >
                              <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                              Guardar
                            </button>
                            <button
                              onClick={onEditCancel}
                              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#F0F0F0] text-[#444444] rounded-md hover:bg-[#E5E5E5] transition-colors"
                              style={{ fontSize: 13, fontWeight: 600 }}
                            >
                              <X className="w-3.5 h-3.5" />
                              Cancelar
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4"></td>
                    </tr>
                  );
                }

                const isIgnored = line.ignored === true;

                return (
                  <tr
                    key={index}
                    className={`border-b border-[#F0F0F0] transition-colors ${
                      isIgnored
                        ? 'bg-[#FAFAFA] opacity-60'
                        : isFlagged
                        ? 'bg-[#FEF8EC] hover:bg-[#FEF1DC]'
                        : 'bg-white hover:bg-[#FAFBFC]'
                    }`}
                    style={{
                      borderLeft: isFlagged && !isIgnored ? '3px solid #B86C00' : 'none',
                    }}
                  >
                    <td
                      className="py-3.5 px-4 text-[#747474]"
                      style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600 }}
                    >
                      {index + 1}
                    </td>
                    <td className="py-3.5 px-4">
                      <div
                        className={`leading-relaxed ${isIgnored ? 'line-through' : ''}`}
                        style={{ fontSize: 12, fontStyle: 'italic', color: isIgnored ? '#A3A3A3' : '#444444' }}
                      >
                        {line.original_text}
                      </div>
                      {line.original_code && (
                        <div
                          className={`mt-0.5 ${isIgnored ? 'line-through' : ''}`}
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 11,
                            color: isIgnored ? '#A3A3A3' : '#747474',
                          }}
                        >
                          {line.original_code}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {isIgnored ? (
                        <span
                          className="uppercase text-[#A3A3A3]"
                          style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em' }}
                        >
                          Ignorada
                        </span>
                      ) : line.matched_product_name ? (
                        <div>
                          <div
                            className="text-[#181818]"
                            style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.005em' }}
                          >
                            {line.matched_product_name}
                          </div>
                          {line.matched_product_code && (
                            <div
                              className="text-[#747474] mt-0.5"
                              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}
                            >
                              {line.matched_product_code}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1.5 text-[#BA0517]"
                          style={{ fontSize: 12, fontStyle: 'italic', fontWeight: 600 }}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Sin coincidencia
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {!isIgnored && (
                        <ConfidenceBadge
                          value={line.confidence}
                          isApproved={line.approved}
                          badgeType={line.badgeType}
                        />
                      )}
                    </td>
                    <td
                      className="py-3.5 px-4 text-center text-[#181818]"
                      style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
                    >
                      {!isIgnored && (
                        isManualMode && line.original_text === 'Agregado manualmente' && onQuantityChange ? (
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={line.quantity}
                            onChange={(e) => {
                              const raw = e.target.value;
                              if (raw === '') return;
                              const parsed = parseInt(raw, 10);
                              if (!isNaN(parsed) && parsed > 0) onQuantityChange(index, parsed);
                            }}
                            onBlur={(e) => {
                              const num = parseFloat(e.target.value);
                              if (!isFinite(num) || num <= 0) {
                                onQuantityChange(index, 1);
                                return;
                              }
                              if (!Number.isInteger(num)) {
                                onQuantityChange(index, Math.round(num));
                              }
                            }}
                            className="w-[70px] text-center border border-[#E5E5E5] rounded-md py-1 px-2 focus:outline-none focus:border-[#0176D3] focus:ring-[3px] focus:ring-[#EAF5FE] transition-all"
                            style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}
                          />
                        ) : (
                          typeof line.quantity === 'number' ? String(line.quantity) : line.quantity
                        )
                      )}
                    </td>
                    <td
                      className="py-3.5 px-4 text-center text-[#444444]"
                      style={{ fontSize: 12 }}
                    >
                      {!isIgnored && line.matched_unit_of_measure}
                    </td>
                    <td
                      className="py-3.5 px-4 text-right text-[#444444]"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {!isIgnored && formatCurrency(line.matched_unit_price, currency)}
                    </td>
                    <td
                      className="py-3.5 px-4 text-right text-[#181818]"
                      style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
                    >
                      {!isIgnored && formatCurrency(lineTotal, currency)}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-center gap-1.5">
                        {isIgnored ? (
                          <button
                            onClick={() => onRestore(index)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#E5E5E5] text-[#444444] rounded-md hover:bg-[#FAFAFA] transition-colors"
                            style={{ fontSize: 11, fontWeight: 600 }}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Restaurar
                          </button>
                        ) : line.approved ? (
                          <div
                            className="inline-flex items-center gap-1 px-2 py-1 bg-[#DEF5E5] text-[#2E844A] rounded-md"
                            style={{ fontSize: 11, fontWeight: 700 }}
                          >
                            <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => onEditStart(index)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-[#E5E5E5] text-[#0176D3] rounded-md hover:bg-[#EAF5FE] hover:border-[#0176D3] transition-colors"
                              style={{ fontSize: 11, fontWeight: 600 }}
                              title="Editar"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              Editar
                            </button>
                            {onReplaceLine && (
                              <button
                                onClick={() => onReplaceLine(index)}
                                className="inline-flex items-center px-2 py-1.5 border border-[#E5E5E5] text-[#747474] rounded-md hover:bg-[#EAF5FE] hover:text-[#0176D3] hover:border-[#0176D3] transition-colors"
                                title="Reemplazar producto"
                              >
                                <PackagePlus className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {isManualMode && line.original_text === 'Agregado manualmente' && onDeleteLine && (
                              <button
                                onClick={() => onDeleteLine(index)}
                                className="inline-flex items-center px-2 py-1.5 border border-[#E5E5E5] text-[#BA0517] rounded-md hover:bg-[#FEDED7] hover:border-[#BA0517] transition-colors"
                                title="Eliminar"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {!isManualMode && isFlagged && (
                              <>
                                <button
                                  onClick={() => onApprove?.(index)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-[#2E844A]/30 text-[#2E844A] rounded-md hover:bg-[#DEF5E5] hover:border-[#2E844A] transition-colors"
                                  style={{ fontSize: 11, fontWeight: 600 }}
                                  title="Aprobar"
                                >
                                  <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                                  OK
                                </button>
                                <button
                                  onClick={() => onIgnore(index)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-[#E5E5E5] text-[#747474] rounded-md hover:bg-[#FEDED7] hover:text-[#BA0517] hover:border-[#BA0517] transition-colors"
                                  style={{ fontSize: 11, fontWeight: 600 }}
                                  title="Ignorar"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  Ignorar
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {showInlineAddRow && onInlineAddProduct && onCancelInlineAdd && (
                <InlineProductLineRow
                  onProductSelect={onInlineAddProduct}
                  onCancel={onCancelInlineAdd}
                />
              )}
            </tbody>
          </table>
        </div>

        {onAddLine && (
          <div className="px-4 py-3 border-t border-[#E5E5E5] bg-[#FAFAFA]">
            <button
              onClick={onAddLine}
              className="inline-flex items-center gap-2 px-4 py-2 border border-[#0176D3] text-[#0176D3] rounded-lg hover:bg-[#EAF5FE] transition-colors bg-white"
              style={{ fontSize: 12, fontWeight: 600 }}
            >
              <PlusCircle className="w-4 h-4" />
              + Agregar linea
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
