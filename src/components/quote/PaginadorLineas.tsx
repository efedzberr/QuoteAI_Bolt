interface Props {
  total: number;
  pagina: number;
  totalPaginas: number;
  tamPagina: number;
  onPagina: (p: number) => void;
  onTamPagina: (t: number) => void;
}

const TAMANOS = [25, 50, 100];

function numerosPagina(actual: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, actual - 1, actual, actual + 1].filter((n) => n >= 1 && n <= total));
  const orden = [...set].sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  orden.forEach((n, i) => {
    if (i > 0 && n - orden[i - 1] > 1) out.push('…');
    out.push(n);
  });
  return out;
}

export default function PaginadorLineas({ total, pagina, totalPaginas, tamPagina, onPagina, onTamPagina }: Props) {
  const desde = total === 0 ? 0 : (pagina - 1) * tamPagina + 1;
  const hasta = Math.min(pagina * tamPagina, total);
  const navBtn = 'px-3 py-1.5 rounded-md text-[#444444] hover:bg-white hover:text-[#0176D3] transition-colors disabled:opacity-40 disabled:pointer-events-none';

  return (
    <div className="px-7 py-4 flex items-center gap-4 flex-wrap" style={{ fontSize: 12 }}>
      <span className="text-[#747474]" style={{ fontVariantNumeric: 'tabular-nums' }}>
        Mostrando <span className="text-[#181818] font-semibold">{desde}–{hasta}</span> de{' '}
        <span className="text-[#181818] font-semibold">{total}</span>
      </span>

      <label className="flex items-center gap-2 text-[#747474]">
        Líneas por página
        <select
          value={tamPagina}
          onChange={(e) => onTamPagina(Number(e.target.value))}
          className="border border-[#E5E5E5] rounded-md px-2 py-1 bg-white text-[#181818] focus:outline-none focus:border-[#0176D3]"
          style={{ fontSize: 12, fontWeight: 600 }}
        >
          {TAMANOS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>

      <div className="flex-1" />

      <nav className="flex items-center gap-1" aria-label="Paginación" style={{ fontWeight: 600 }}>
        <button className={navBtn} disabled={pagina <= 1} onClick={() => onPagina(pagina - 1)}>
          ‹ Anterior
        </button>
        {numerosPagina(pagina, totalPaginas).map((n, i) =>
          n === '…' ? (
            <span key={`e${i}`} className="px-2 text-[#A3A3A3]">…</span>
          ) : (
            <button
              key={n}
              onClick={() => onPagina(n)}
              aria-current={n === pagina ? 'page' : undefined}
              className={`min-w-[32px] px-2 py-1.5 rounded-md transition-colors ${
                n === pagina ? 'bg-[#0176D3] text-white' : 'text-[#444444] hover:bg-white hover:text-[#0176D3]'
              }`}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {n}
            </button>
          )
        )}
        <button className={navBtn} disabled={pagina >= totalPaginas} onClick={() => onPagina(pagina + 1)}>
          Siguiente ›
        </button>
      </nav>
    </div>
  );
}
