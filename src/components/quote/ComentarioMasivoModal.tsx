import { useState } from 'react';
import { X } from 'lucide-react';

interface Props {
  cantidad: number;
  onConfirm: (comentario: string | null) => void;
  onCancel: () => void;
}

export default function ComentarioMasivoModal({ cantidad, onConfirm, onCancel }: Props) {
  const [comentario, setComentario] = useState('');

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div
        className="bg-white rounded-xl w-full max-w-lg mx-4 border border-[#E5E5E5]"
        style={{ boxShadow: '0 12px 24px rgba(0,0,0,.15)', fontFamily: "'Manrope', sans-serif" }}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-[#F0F0F0]">
          <h3 className="text-[#181818]" style={{ fontSize: 17, fontWeight: 700 }}>
            Comentario para {cantidad} {cantidad === 1 ? 'línea' : 'líneas'}
          </h3>
          <button onClick={onCancel} className="text-[#747474] hover:text-[#181818] transition-colors" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5">
          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="Escribe una anotacion (color, talla, precision)..."
            className="w-full border border-[#E5E5E5] rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-[#0176D3] focus:ring-2 focus:ring-[#EAF5FE]"
            rows={3}
            autoFocus
          />
          <p className="text-[#747474] mt-1" style={{ fontSize: 11, lineHeight: 1.5 }}>
            Reemplaza el comentario que ya tengan. Déjalo vacío para borrarlo.
          </p>
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
            onClick={() => onConfirm(comentario.trim() || null)}
            className="px-5 py-2.5 text-white rounded-lg bg-[#0176D3] hover:bg-[#014486] transition-colors"
            style={{ fontSize: 13, fontWeight: 600 }}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
