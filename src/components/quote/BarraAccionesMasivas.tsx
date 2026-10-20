import type { ReactNode } from 'react';
import { Check, Trash2, RotateCcw, MessageSquare } from 'lucide-react';

interface Props {
  cantidad: number;
  aplicaValidar: number;
  aplicaEliminar: number;
  aplicaRestaurar: number;
  onValidar: () => void;
  onEliminar: () => void;
  onRestaurar: () => void;
  onComentario: () => void;
  onQuitar: () => void;
}

function Accion({ icono, etiqueta, deshabilitado, motivo, onClick, clase }: {
  icono: ReactNode;
  etiqueta: string;
  deshabilitado: boolean;
  motivo: string;
  onClick: () => void;
  clase: string;
}) {
  return (
    <div className="relative group">
      <button
        onClick={onClick}
        disabled={deshabilitado}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border transition-colors disabled:bg-[#F3F3F3] disabled:border-[#E5E5E5] disabled:text-[#A3A3A3] disabled:cursor-not-allowed ${clase}`}
        style={{ fontSize: 12, fontWeight: 600 }}
      >
        {icono}
        {etiqueta}
      </button>
      {deshabilitado && (
        <div
          className="absolute top-full left-0 mt-2 z-20 px-3 py-2 bg-[#181818] text-white rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
          style={{ fontSize: 11, fontWeight: 500 }}
        >
          {motivo}
          <div className="absolute bottom-full left-4 w-2 h-2 bg-[#181818] rotate-45 translate-y-1"></div>
        </div>
      )}
    </div>
  );
}

export default function BarraAccionesMasivas({
  cantidad, aplicaValidar, aplicaEliminar, aplicaRestaurar,
  onValidar, onEliminar, onRestaurar, onComentario, onQuitar,
}: Props) {
  return (
    <div className="bg-[#EAF5FE] border-t border-[#0176D3]/20">
      <div className="max-w-[1480px] mx-auto px-7 py-2 flex items-center gap-2 flex-wrap">
        <span className="text-[#014486] mr-2" style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {cantidad} {cantidad === 1 ? 'seleccionada' : 'seleccionadas'}
        </span>
        <Accion
          icono={<Check className="w-3.5 h-3.5" />}
          etiqueta="Validar (OK)"
          deshabilitado={aplicaValidar === 0}
          motivo="Ninguna línea seleccionada está pendiente"
          onClick={onValidar}
          clase="bg-[#2E844A] border-[#2E844A] text-white hover:bg-[#256E3D]"
        />
        <Accion
          icono={<Trash2 className="w-3.5 h-3.5" />}
          etiqueta="Eliminar"
          deshabilitado={aplicaEliminar === 0}
          motivo="Todas las líneas seleccionadas ya están eliminadas"
          onClick={onEliminar}
          clase="bg-white border-[#E5E5E5] text-[#444444] hover:border-[#BA0517] hover:text-[#BA0517]"
        />
        <Accion
          icono={<RotateCcw className="w-3.5 h-3.5" />}
          etiqueta="Restaurar"
          deshabilitado={aplicaRestaurar === 0}
          motivo="Ninguna línea seleccionada está eliminada"
          onClick={onRestaurar}
          clase="bg-white border-[#E5E5E5] text-[#444444] hover:border-[#0176D3] hover:text-[#0176D3]"
        />
        <Accion
          icono={<MessageSquare className="w-3.5 h-3.5" />}
          etiqueta="Comentario"
          deshabilitado={false}
          motivo=""
          onClick={onComentario}
          clase="bg-white border-[#E5E5E5] text-[#444444] hover:border-[#0176D3] hover:text-[#0176D3]"
        />
        <div className="flex-1" />
        <button
          onClick={onQuitar}
          className="text-[#0176D3] hover:underline"
          style={{ fontSize: 12, fontWeight: 600 }}
        >
          Quitar selección
        </button>
      </div>
    </div>
  );
}
