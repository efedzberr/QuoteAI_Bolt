import { useState } from 'react';
import { X } from 'lucide-react';
import type { MotivoEliminacion } from '../../lib/jobLines';

interface Props {
  open: boolean;
  modo: 'eliminar' | 'motivo';
  lineaTexto: string;
  productoSugerido: string | null;
  motivos: MotivoEliminacion[];
  motivoInicial: number | null;
  comentarioInicial: string | null;
  onConfirm: (motivoId: number | null, comentario: string | null) => void;
  onCancel: () => void;
}

export default function EliminarLineaModal({
  open,
  modo,
  lineaTexto,
  productoSugerido,
  motivos,
  motivoInicial,
  comentarioInicial,
  onConfirm,
  onCancel,
}: Props) {
  const [motivoId, setMotivoId] = useState<number | null>(motivoInicial);
  const [comentario, setComentario] = useState(comentarioInicial ?? '');

  if (!open) return null;

  const title = modo === 'eliminar' ? 'Eliminar l\u00ednea' : 'Motivo de eliminaci\u00f3n';
  const confirmLabel = modo === 'eliminar' ? 'Eliminar' : 'Guardar';
  const confirmColor = modo === 'eliminar'
    ? 'bg-[#BA0517] hover:bg-[#8E0410]'
    : 'bg-[#0176D3] hover:bg-[#014486]';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div
        className="bg-white rounded-xl w-full max-w-lg mx-4 border border-[#E5E5E5]"
        style={{ boxShadow: '0 12px 24px rgba(0,0,0,.15)', fontFamily: "'Manrope', sans-serif" }}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-[#F0F0F0]">
          <h3 className="text-[#181818]" style={{ fontSize: 17, fontWeight: 700 }}>{title}</h3>
          <button onClick={onCancel} className="text-[#747474] hover:text-[#181818] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div>
            <p className="text-[#747474] italic mb-1" style={{ fontSize: 12, lineHeight: 1.5 }}>
              {lineaTexto}
            </p>
            {productoSugerido && (
              <p className="text-[#444444]" style={{ fontSize: 12 }}>
                Producto sugerido: <span className="font-semibold">{productoSugerido}</span>
              </p>
            )}
          </div>

          <div>
            <p className="text-[#181818] mb-2" style={{ fontSize: 13, fontWeight: 600 }}>Motivo</p>
            <p className="text-[#747474] mb-3" style={{ fontSize: 11, lineHeight: 1.5 }}>
              Opcional. Si no eliges motivo, la l&iacute;nea quedar&aacute; pendiente de clasificar.
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {motivos.map((m) => (
                <label
                  key={m.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    motivoId === m.id
                      ? 'border-[#0176D3] bg-[#EAF5FE]'
                      : 'border-[#E5E5E5] hover:border-[#C4C4C4]'
                  }`}
                >
                  <input
                    type="radio"
                    name="motivo"
                    checked={motivoId === m.id}
                    onChange={() => setMotivoId(m.id)}
                    className="mt-0.5 accent-[#0176D3]"
                  />
                  <div>
                    <span className="text-[#181818]" style={{ fontSize: 13, fontWeight: 600 }}>
                      {m.nombre}
                    </span>
                    {m.descripcion && (
                      <span className="block text-[#747474] mt-0.5" style={{ fontSize: 11, lineHeight: 1.4 }}>
                        {m.descripcion}
                      </span>
                    )}
                  </div>
                </label>
              ))}
              {motivoId !== null && (
                <button
                  onClick={() => setMotivoId(null)}
                  className="text-[#0176D3] hover:underline"
                  style={{ fontSize: 11, fontWeight: 600 }}
                >
                  Quitar motivo
                </button>
              )}
            </div>
          </div>

          <div>
            <p className="text-[#181818] mb-2" style={{ fontSize: 13, fontWeight: 600 }}>
              Comentario <span className="text-[#A3A3A3] font-normal">(opcional)</span>
            </p>
            <textarea
              value={comentario}
              onChange={(e) => { if (e.target.value.length <= 300) setComentario(e.target.value); }}
              placeholder="Raz\u00f3n adicional..."
              className="w-full border border-[#E5E5E5] rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-[#0176D3] focus:ring-2 focus:ring-[#EAF5FE]"
              rows={2}
            />
            <div className="text-right mt-1">
              <span className="text-[#A3A3A3]" style={{ fontSize: 10 }}>{comentario.length}/300</span>
            </div>
          </div>

          {modo === 'eliminar' && (
            <p className="text-[#747474] bg-[#FAFAFA] rounded-lg px-4 py-3" style={{ fontSize: 12, lineHeight: 1.5 }}>
              La l&iacute;nea no aparecer&aacute; en el PDF ni se enviar&aacute; a Salesforce. Podr&aacute;s restaurarla despu&eacute;s.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 pb-5 pt-2">
          <button
            onClick={onCancel}
            className="px-4 py-2.5 text-[#444444] bg-[#F0F0F0] rounded-lg hover:bg-[#E5E5E5] transition-colors"
            style={{ fontSize: 13, fontWeight: 600 }}
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(motivoId, comentario.trim() || null)}
            className={`px-5 py-2.5 text-white rounded-lg transition-colors ${confirmColor}`}
            style={{ fontSize: 13, fontWeight: 600 }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
