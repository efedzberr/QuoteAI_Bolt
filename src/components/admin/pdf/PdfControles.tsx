import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { claseEtiqueta } from './pdfEditorUtil';

/** Sección plegable del editor de la plantilla. */
export function Seccion({
  titulo,
  resumen,
  abierta,
  onAlternar,
  children,
}: {
  titulo: string;
  resumen: string;
  abierta: boolean;
  onAlternar: () => void;
  children: ReactNode;
}) {
  return (
    <section className="border border-rule rounded-card overflow-hidden bg-white">
      <button
        type="button"
        onClick={onAlternar}
        aria-expanded={abierta}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-rule-soft/60 transition-colors"
      >
        <span className="min-w-0">
          <span className="block text-sm font-bold text-ink">{titulo}</span>
          <span className="block text-xs text-ink-faint mt-0.5 truncate">{resumen}</span>
        </span>
        <ChevronDown className={`w-4 h-4 text-ink-faint flex-shrink-0 transition-transform ${abierta ? 'rotate-180' : ''}`} />
      </button>
      {abierta && <div className="px-4 pt-4 pb-4 space-y-4 border-t border-rule-soft">{children}</div>}
    </section>
  );
}

/** Etiqueta con su control debajo y, si hace falta, una nota de ayuda. */
export function Campo({ etiqueta, ayuda, children }: { etiqueta: string; ayuda?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className={claseEtiqueta}>{etiqueta}</span>
      {children}
      {ayuda ? <span className="block text-xs text-ink-faint mt-1">{ayuda}</span> : null}
    </label>
  );
}

/** Título pequeño para separar grupos dentro de una sección. */
export function Subtitulo({ children }: { children: ReactNode }) {
  return <h4 className="text-xs font-bold text-ink uppercase tracking-wide pt-3 border-t border-rule-soft">{children}</h4>;
}

/** Interruptor de encendido y apagado. */
export function Interruptor({
  activo,
  onCambio,
  etiqueta,
  ayuda,
}: {
  activo: boolean;
  onCambio: (activo: boolean) => void;
  etiqueta: string;
  ayuda?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={activo}
        aria-label={etiqueta}
        onClick={() => onCambio(!activo)}
        className={`relative mt-0.5 w-9 h-5 rounded-full flex-shrink-0 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-soft ${activo ? 'bg-brand' : 'bg-[#C9C9C9]'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${activo ? 'translate-x-4' : ''}`} />
      </button>
      <span className="text-sm text-ink leading-5">
        {etiqueta}
        {ayuda ? <span className="block text-xs text-ink-faint">{ayuda}</span> : null}
      </span>
    </div>
  );
}
