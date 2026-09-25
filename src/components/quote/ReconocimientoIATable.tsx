import ConfidenceBadge from '../ConfidenceBadge';
import type { JobLineVersionMeta } from '../../lib/jobLines';

interface Props {
  lines: JobLineVersionMeta[];
  currency: string;
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

const METHOD_LABELS: Record<string, { label: string; accent?: boolean }> = {
  codigo: { label: 'C\u00f3digo' },
  exacto: { label: 'Exacto' },
  fuzzy: { label: 'Similitud' },
  keyword: { label: 'Palabras clave' },
  aprendido: { label: 'Aprendido', accent: true },
  aprendido_sugerido: { label: 'Sugerido por aprendizaje', accent: true },
  ingenieria: { label: 'Ingenier\u00eda' },
  ninguno: { label: 'Sin coincidencia' },
  historico: { label: 'Hist\u00f3rico' },
};

function MethodPill({ method }: { method: string | null }) {
  if (!method) return <span className="text-[#C4C4C4]">&mdash;</span>;
  const entry = METHOD_LABELS[method];
  const label = entry?.label ?? method;
  const isAccent = entry?.accent ?? false;
  return (
    <span
      className="inline-block rounded-full px-2.5 py-0.5 whitespace-nowrap"
      style={{
        fontSize: 10,
        fontWeight: 700,
        backgroundColor: isAccent ? '#EAF5FE' : '#F0F0F0',
        color: isAccent ? '#0176D3' : '#444444',
      }}
    >
      {label}
    </span>
  );
}

export default function ReconocimientoIATable({ lines, currency }: Props) {
  const iaLines = lines.filter((l) => l.ia_capturado_at !== null);
  const manualCount = lines.length - iaLines.length;

  if (iaLines.length === 0) {
    return (
      <div className="px-7 py-16 text-center">
        <p className="text-[#747474]" style={{ fontSize: 13 }}>
          Esta cotizaci&oacute;n no tiene reconocimiento IA registrado.
        </p>
      </div>
    );
  }

  const subtotal = iaLines.reduce((sum, l) => {
    const qty = l.cantidad ?? 0;
    const price = l.ia_precio_unitario ?? 0;
    return sum + qty * price;
  }, 0);

  return (
    <div className="px-7">
      <div className="border border-[#E5E5E5] rounded-xl overflow-hidden bg-white">
        <table className="w-full text-left" style={{ fontFamily: "'Manrope', sans-serif" }}>
          <thead>
            <tr className="bg-[#FAFAFA] border-b border-[#E5E5E5]">
              <th className="px-3 py-3 text-[#747474] w-10" style={TH_STYLE}>#</th>
              <th className="px-3 py-3 text-[#747474]" style={TH_STYLE}>SOLICITUD</th>
              <th className="px-3 py-3 text-[#747474]" style={TH_STYLE}>PRODUCTO RECONOCIDO</th>
              <th className="px-3 py-3 text-[#747474] text-center" style={TH_STYLE}>M&Eacute;TODO</th>
              <th className="px-3 py-3 text-[#747474] text-center" style={TH_STYLE}>CONFIANZA</th>
              <th className="px-3 py-3 text-[#747474] text-right" style={TH_STYLE}>CANT.</th>
              <th className="px-3 py-3 text-[#747474]" style={TH_STYLE}>U.M.</th>
              <th className="px-3 py-3 text-[#747474] text-right" style={TH_STYLE}>PRECIO UNIT.</th>
              <th className="px-3 py-3 text-[#747474] text-right" style={TH_STYLE}>IMPORTE</th>
            </tr>
          </thead>
          <tbody>
            {iaLines.map((l) => {
              const importe = (l.cantidad ?? 0) * (l.ia_precio_unitario ?? 0);
              return (
                <tr key={l.line_index} className="border-b border-[#F0F0F0] last:border-0 hover:bg-[#FAFAFA]">
                  <td className="px-3 py-2.5 text-[#A3A3A3]" style={{ fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {l.line_index + 1}
                  </td>
                  <td className="px-3 py-2.5 max-w-[220px]">
                    <div className="text-[#181818] truncate" style={{ fontSize: 12, lineHeight: 1.4 }}>{l.descripcion_original ?? ''}</div>
                    {l.codigo_original && (
                      <div className="text-[#747474] mt-0.5 truncate" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }}>
                        {l.codigo_original}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 max-w-[220px]">
                    {l.ia_producto_codigo ? (
                      <div>
                        <div className="text-[#181818] truncate" style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.4 }}>
                          {l.ia_producto_descripcion ?? ''}
                        </div>
                        <div className="text-[#747474] mt-0.5 truncate" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }}>
                          {l.ia_producto_codigo}
                        </div>
                      </div>
                    ) : (
                      <span className="text-[#BA0517] italic" style={{ fontSize: 12, fontWeight: 600 }}>Sin coincidencia</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center"><MethodPill method={l.ia_metodo} /></td>
                  <td className="px-3 py-2.5 text-center">
                    <ConfidenceBadge value={l.ia_confianza ?? 0} />
                  </td>
                  <td className="px-3 py-2.5 text-right text-[#181818]" style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {l.cantidad ?? '\u2014'}
                  </td>
                  <td className="px-3 py-2.5 text-[#747474]" style={{ fontSize: 12 }}>
                    {l.ia_unidad_medida ?? '\u2014'}
                    {l.unidad_no_encontrada === true && l.unidad_original && (
                      <span
                        className="block mt-1 inline-flex items-center gap-0.5 rounded-full px-2 py-0.5"
                        style={{ fontSize: 10, fontWeight: 700, backgroundColor: '#FEDED7', color: '#BA0517' }}
                      >
                        Cliente: {l.unidad_original}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[#181818]" style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrency(l.ia_precio_unitario, currency)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[#181818]" style={{ fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrency(importe || null, currency)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[#E5E5E5] bg-[#FAFAFA]">
              <td colSpan={8} className="px-3 py-3 text-right text-[#747474]" style={{ fontSize: 13, fontWeight: 600 }}>
                Subtotal IA
              </td>
              <td className="px-3 py-3 text-right text-[#181818]" style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {formatCurrency(subtotal, currency)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {manualCount > 0 && (
        <p className="text-[#747474] mt-3 text-center" style={{ fontSize: 12 }}>
          {manualCount} {manualCount === 1 ? 'l\u00ednea agregada manualmente no tiene' : 'l\u00edneas agregadas manualmente no tienen'} reconocimiento IA.
        </p>
      )}
    </div>
  );
}

const TH_STYLE: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: '0.08em' };
