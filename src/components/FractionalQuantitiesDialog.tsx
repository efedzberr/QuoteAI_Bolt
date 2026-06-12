import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';

export interface FractionalRow {
  index: number;
  descripcion: string;
  valorOriginal: number;
  valorRedondeado: number;
  valorTruncado: number;
}

export type FractionalDecision = 'round' | 'truncate';

interface FractionalQuantitiesDialogProps {
  rows: FractionalRow[];
  onCancel: () => void;
  onConfirm: (decisions: Record<number, FractionalDecision>) => void;
}

export default function FractionalQuantitiesDialog({
  rows,
  onCancel,
  onConfirm,
}: FractionalQuantitiesDialogProps) {
  const [decisions, setDecisions] = useState<Record<number, FractionalDecision>>(() => {
    const initial: Record<number, FractionalDecision> = {};
    rows.forEach((r) => {
      initial[r.index] = 'round';
    });
    return initial;
  });

  const setOne = (index: number, decision: FractionalDecision) => {
    setDecisions((prev) => ({ ...prev, [index]: decision }));
  };

  const applyAll = (decision: FractionalDecision) => {
    const next: Record<number, FractionalDecision> = {};
    rows.forEach((r) => {
      next[r.index] = decision;
    });
    setDecisions(next);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="px-8 pt-7 pb-4 border-b border-gray-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Cantidades con decimales detectadas
              </h2>
              <p className="text-sm text-gray-600 mt-1.5">
                Encontramos {rows.length} producto{rows.length === 1 ? '' : 's'} con cantidades fraccionarias.
                Solo se pueden manejar unidades enteras. Por favor decide qué hacer con cada uno:
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-5 space-y-3">
          {rows.map((row) => {
            const decision = decisions[row.index];
            return (
              <div
                key={row.index}
                className="border border-gray-200 rounded-lg p-4 bg-gray-50"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Fila #{row.index}
                    </div>
                    <div className="text-sm font-medium text-gray-900 mt-0.5 truncate">
                      {row.descripcion || '(sin descripción)'}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Cantidad original
                    </div>
                    <div className="text-lg font-bold text-amber-600 mt-0.5">
                      {row.valorOriginal}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setOne(row.index, 'truncate')}
                    className={`py-2.5 px-3 rounded-md text-sm font-semibold border-2 transition-colors ${
                      decision === 'truncate'
                        ? 'bg-[#1E3A5F] border-[#1E3A5F] text-white'
                        : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    Truncar a {row.valorTruncado}
                  </button>
                  <button
                    onClick={() => setOne(row.index, 'round')}
                    className={`py-2.5 px-3 rounded-md text-sm font-semibold border-2 transition-colors ${
                      decision === 'round'
                        ? 'bg-[#00A99D] border-[#00A99D] text-white'
                        : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    Redondear a {row.valorRedondeado}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-8 py-4 bg-gray-50 border-t border-gray-200">
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 self-center mr-1">
              Aplicar a todos:
            </span>
            <button
              onClick={() => applyAll('truncate')}
              className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
            >
              Truncar
            </button>
            <button
              onClick={() => applyAll('round')}
              className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
            >
              Redondear
            </button>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={onCancel}
              className="px-5 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => onConfirm(decisions)}
              className="px-6 py-2.5 text-sm font-bold text-white bg-[#1E3A5F] rounded-lg hover:bg-[#2a4d7f] transition-colors"
            >
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
