import type { JobLineVersionMeta } from '../../lib/jobLines';

interface Props {
  rows: Record<string, any>[] | null;
  fallbackLines: JobLineVersionMeta[];
}

export default function SolicitudOriginalTable({ rows, fallbackLines }: Props) {
  const useFallback = !rows || rows.length === 0;
  const displayRows = useFallback
    ? fallbackLines.map((fl, i) => ({
        _n: i + 1,
        codigo: fl.codigo_original ?? '',
        descripcion: fl.descripcion_original ?? '',
        unidad: fl.unidad_original ?? '',
        cantidad: fl.cantidad ?? '',
      }))
    : rows.map((r, i) => ({
        _n: i + 1,
        codigo: r.Codigo ?? r.codigo ?? r.CodigoOriginal ?? r.codigo_original ?? '',
        descripcion: r.Descripcion ?? r.descripcion ?? r.original_text ?? r.descripcion_original ?? '',
        unidad: r.Unid ?? r.unidad ?? r.unidad_original ?? '',
        cantidad: r.Cant ?? r.cantidad ?? r.quantity ?? '',
      }));

  if (displayRows.length === 0) {
    return (
      <div className="px-7 py-16 text-center">
        <p className="text-[#747474]" style={{ fontSize: 13 }}>
          No hay datos de la solicitud original disponibles.
        </p>
      </div>
    );
  }

  return (
    <div className="px-7">
      {useFallback && (
        <div className="mb-4 rounded-lg border border-[#F59E0B]/30 bg-[#FFFBEB] px-4 py-3">
          <p className="text-[#92400E]" style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.5 }}>
            Esta cotizaci&oacute;n es anterior al registro de la solicitud original.
            Se muestra la solicitud como qued&oacute; despu&eacute;s de la revisi&oacute;n de datos.
          </p>
        </div>
      )}

      <p className="text-[#747474] mb-3" style={{ fontSize: 12, lineHeight: 1.5 }}>
        Lo que se ley&oacute; del archivo del cliente, antes de cualquier correcci&oacute;n. Solo consulta.
        <span className="ml-2 font-semibold text-[#444444]">{displayRows.length} renglones</span>
      </p>

      <div className="border border-[#E5E5E5] rounded-xl overflow-hidden bg-white">
        <table className="w-full text-left" style={{ fontFamily: "'Manrope', sans-serif" }}>
          <thead>
            <tr className="bg-[#FAFAFA] border-b border-[#E5E5E5]">
              <th className="px-4 py-3 text-[#747474] w-12" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em' }}>#</th>
              <th className="px-4 py-3 text-[#747474]" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em' }}>C&Oacute;DIGO</th>
              <th className="px-4 py-3 text-[#747474]" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em' }}>DESCRIPCI&Oacute;N</th>
              <th className="px-4 py-3 text-[#747474]" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em' }}>UNIDAD</th>
              <th className="px-4 py-3 text-[#747474] text-right" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em' }}>CANTIDAD</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((r) => (
              <tr key={r._n} className="border-b border-[#F0F0F0] last:border-0 hover:bg-[#FAFAFA]">
                <td className="px-4 py-2.5 text-[#A3A3A3]" style={{ fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{r._n}</td>
                <td className="px-4 py-2.5 text-[#181818]" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
                  {r.codigo || <span className="text-[#C4C4C4]">&mdash;</span>}
                </td>
                <td className="px-4 py-2.5 text-[#181818] max-w-md" style={{ fontSize: 13, lineHeight: 1.4 }}>{r.descripcion}</td>
                <td className="px-4 py-2.5 text-[#747474]" style={{ fontSize: 12 }}>{r.unidad || '\u2014'}</td>
                <td className="px-4 py-2.5 text-[#181818] text-right" style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{r.cantidad}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
