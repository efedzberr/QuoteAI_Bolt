import { Loader2 } from 'lucide-react';
import { fechaTc, formatoTc, nombreFuenteTc, type Moneda, type MonedaPropuesta } from '../../lib/monedas';

interface Props {
  valor: MonedaPropuesta;
  monedas: Moneda[];
  editable: boolean;
  guardando: boolean;
  onChange: (codigo: string) => void;
}

/** Campo "Moneda" del encabezado: selector de monedas activas y tipo de cambio fijado en la propuesta. */
export default function SelectorMoneda({ valor, monedas, editable, guardando, onChange }: Props) {
  const enLista = monedas.some((m) => m.codigo === valor.moneda);
  return (
    <div className="flex flex-col">
      <span className="uppercase text-[#747474]" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em' }}>
        Moneda
      </span>
      {editable && monedas.length > 1 ? (
        <span className="mt-1 inline-flex items-center gap-1.5">
          <select
            value={valor.moneda}
            disabled={guardando}
            onChange={(e) => onChange(e.target.value)}
            className="border border-[#E5E5E5] rounded-md py-1 pl-2 pr-1 bg-white text-[#181818] focus:outline-none focus:border-[#0176D3] focus:ring-[3px] focus:ring-[#EAF5FE]"
            style={{ fontSize: 13, fontWeight: 700 }}
            aria-label="Moneda de la propuesta"
          >
            {!enLista && <option value={valor.moneda}>{valor.moneda}</option>}
            {monedas.map((m) => (
              <option key={m.codigo} value={m.codigo}>{m.codigo} — {m.nombre}</option>
            ))}
          </select>
          {guardando && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#747474]" />}
        </span>
      ) : (
        <span className="mt-1 text-[#181818]" style={{ fontSize: 14, fontWeight: 700 }}>{valor.moneda}</span>
      )}
      {valor.moneda !== 'MXN' && valor.tipoCambio ? (
        <span className="mt-0.5 text-[#747474]" style={{ fontSize: 11, lineHeight: 1.4 }}>
          TC {formatoTc(valor.tipoCambio)}
          {valor.fuente ? ` · ${nombreFuenteTc(valor.fuente)}` : ''}
          {valor.fecha ? ` · ${fechaTc(valor.fecha)}` : ''}
        </span>
      ) : null}
    </div>
  );
}
