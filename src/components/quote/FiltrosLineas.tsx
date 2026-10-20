export type FiltroLineas = 'todas' | 'pendientes' | 'validadas' | 'especiales' | 'eliminadas';

export const FILTROS_LINEAS: { id: FiltroLineas; etiqueta: string; colorConteo?: string }[] = [
  { id: 'todas', etiqueta: 'Todos' },
  { id: 'pendientes', etiqueta: 'Pendientes', colorConteo: '#B86C00' },
  { id: 'validadas', etiqueta: 'Validados' },
  { id: 'especiales', etiqueta: 'Especiales', colorConteo: '#BA0517' },
  { id: 'eliminadas', etiqueta: 'Eliminados', colorConteo: '#747474' },
];

interface Props {
  activo: FiltroLineas;
  conteos: Record<FiltroLineas, number>;
  onCambiar: (f: FiltroLineas) => void;
}

export function ChipsFiltroLineas({ activo, conteos, onCambiar }: Props) {
  return (
    <div className="flex items-center gap-2 flex-wrap" role="tablist" aria-label="Filtrar líneas">
      {FILTROS_LINEAS.map((f) => {
        const esActivo = f.id === activo;
        return (
          <button
            key={f.id}
            role="tab"
            aria-selected={esActivo}
            onClick={() => onCambiar(f.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors ${
              esActivo
                ? 'bg-[#0176D3] text-white'
                : 'bg-white border border-[#E5E5E5] text-[#444444] hover:border-[#0176D3]'
            }`}
            style={{ fontSize: 12, fontWeight: 600 }}
          >
            {f.etiqueta}
            <span
              style={{ fontVariantNumeric: 'tabular-nums', color: esActivo ? 'rgba(255,255,255,.85)' : f.colorConteo ?? '#747474' }}
            >
              {conteos[f.id]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
