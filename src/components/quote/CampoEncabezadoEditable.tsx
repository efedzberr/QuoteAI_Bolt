import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, Pencil, X } from 'lucide-react';

interface CampoEncabezadoEditableProps {
  label: string;
  value: string;
  /** false = se muestra como dato de solo lectura. */
  editable: boolean;
  maxLength: number;
  /** Convierte a mayúsculas mientras se escribe (igual que la captura de la cotización). */
  mayusculas?: boolean;
  /** Texto del campo vacío cuando se puede editar. */
  textoVacio?: string;
  placeholder?: string;
  /** Guarda el valor. Devuelve null si se guardó o el mensaje de error. */
  onSave: (valor: string) => Promise<string | null>;
}

const ESTILO_ETIQUETA = { fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', fontFamily: "'Manrope', sans-serif" } as const;
const ESTILO_VALOR = { fontSize: 14, fontWeight: 700, fontFamily: "'Manrope', sans-serif" } as const;

/** Dato del encabezado de la cotización que se edita en su lugar: lápiz, Enter guarda, Esc cancela. */
export default function CampoEncabezadoEditable({
  label,
  value,
  editable,
  maxLength,
  mayusculas,
  textoVacio = 'Agregar',
  placeholder,
  onSave,
}: CampoEncabezadoEditableProps) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(value);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editando) inputRef.current?.select();
  }, [editando]);

  // Al terminar de guardar con error, el cursor regresa al campo para corregir o cancelar con Esc
  useEffect(() => {
    if (editando && !guardando) inputRef.current?.focus();
  }, [editando, guardando]);

  const abrir = () => {
    setTexto(value);
    setError(null);
    setEditando(true);
  };

  const cancelar = () => {
    if (guardando) return;
    setEditando(false);
    setError(null);
  };

  const guardar = async () => {
    if (guardando) return;
    const limpio = texto.trim();
    if (limpio === value.trim()) {
      setEditando(false);
      return;
    }
    setGuardando(true);
    const mensaje = await onSave(limpio);
    setGuardando(false);
    if (mensaje) {
      setError(mensaje);
      return;
    }
    setEditando(false);
    setError(null);
  };

  if (!editando) {
    return (
      <div className="flex flex-col">
        <span className="uppercase text-[#747474]" style={ESTILO_ETIQUETA}>{label}</span>
        {editable ? (
          <button
            type="button"
            onClick={abrir}
            title={`Editar ${label.toLowerCase()}`}
            className="group mt-1 inline-flex items-center gap-1.5 text-left rounded hover:text-[#0176D3] focus:outline-none focus:ring-2 focus:ring-[#EAF5FE]"
            style={ESTILO_VALOR}
          >
            {value ? (
              <span className="text-[#181818] group-hover:text-[#0176D3]">{value}</span>
            ) : (
              <span className="text-[#0176D3]" style={{ fontWeight: 600 }}>+ {textoVacio}</span>
            )}
            {value && <Pencil className="w-3 h-3 text-[#A3A3A3] group-hover:text-[#0176D3]" />}
          </button>
        ) : (
          <span className="text-[#181818] mt-1" style={ESTILO_VALOR}>{value || '—'}</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <span className="uppercase text-[#747474]" style={ESTILO_ETIQUETA}>{label}</span>
      <div className="mt-0.5 flex items-center gap-1">
        <input
          ref={inputRef}
          type="text"
          value={texto}
          maxLength={maxLength}
          placeholder={placeholder}
          disabled={guardando}
          autoFocus
          onChange={(e) => setTexto(mayusculas ? e.target.value.toLocaleUpperCase('es-MX') : e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); guardar(); }
            if (e.key === 'Escape') { e.preventDefault(); cancelar(); }
          }}
          className="w-[200px] px-2 py-1 border border-[#0176D3] rounded-md text-[#181818] placeholder:text-[#A3A3A3] focus:outline-none focus:ring-[3px] focus:ring-[#EAF5FE]"
          style={{ fontSize: 13, fontWeight: 600, fontFamily: "'Manrope', sans-serif" }}
        />
        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          title="Guardar"
          className="p-1.5 rounded-md bg-[#0176D3] text-white hover:bg-[#014486] disabled:opacity-60"
        >
          {guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
        </button>
        <button
          type="button"
          onClick={cancelar}
          disabled={guardando}
          title="Cancelar"
          className="p-1.5 rounded-md border border-[#E5E5E5] text-[#444444] hover:bg-[#F3F3F3] disabled:opacity-60"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {error && (
        <span className="mt-1 text-[#BA0517]" style={{ fontSize: 11, fontWeight: 600 }}>{error}</span>
      )}
    </div>
  );
}
