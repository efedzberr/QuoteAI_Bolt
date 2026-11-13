import { TrendingDown, TrendingUp } from 'lucide-react';
import { fechaTc, formatoTc, nombreFuenteTc, variacionTc } from '../../lib/monedas';

interface Props {
  moneda: string;
  anterior: number;
  vigente: number;
  fuente: string | null;
  fecha: string | null;
  subtotalActual: string;
  subtotalNuevo: string;
  guardando: boolean;
  onAceptar: () => void;
}

/** Aviso al abrir una propuesta: su tipo de cambio ya no es el vigente y se actualizará al dar OK. */
export default function AvisoTipoCambioModal({ moneda, anterior, vigente, fuente, fecha, subtotalActual, subtotalNuevo, guardando, onAceptar }: Props) {
  const variacion = variacionTc(anterior, vigente);
  const subio = variacion > 0;
  const Icono = subio ? TrendingUp : TrendingDown;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full mx-4" role="alertdialog" aria-modal="true">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ backgroundColor: '#FEF3C7' }}>
            <Icono className="w-5 h-5" style={{ color: '#B86C00' }} />
          </div>
          <h3 className="text-[#181818]" style={{ fontSize: 17, fontWeight: 700 }}>Se actualizará el tipo de cambio</h3>
        </div>
        <p className="text-[#444] mb-4" style={{ fontSize: 13, lineHeight: 1.55 }}>
          Esta propuesta está en {moneda} y su tipo de cambio ya no es el vigente: el {moneda} {subio ? 'subió' : 'bajó'}{' '}
          <strong>{Math.abs(variacion).toFixed(2)}%</strong> frente al peso. La propuesta se actualizará al tipo de cambio vigente.
        </p>
        <div className="bg-[#F8F9FA] rounded-lg p-4 mb-4" style={{ fontSize: 13 }}>
          <div className="flex justify-between py-1">
            <span className="text-[#747474]">Tipo de cambio anterior</span>
            <span className="text-[#181818]" style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>1 {moneda} = {formatoTc(anterior)} MXN</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-[#747474]">Tipo de cambio nuevo{fuente ? ` (${nombreFuenteTc(fuente)}${fecha ? `, ${fechaTc(fecha)}` : ''})` : ''}</span>
            <span className="text-[#181818]" style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>1 {moneda} = {formatoTc(vigente)} MXN</span>
          </div>
          <div className="border-t border-[#E5E5E5] my-2" />
          <div className="flex justify-between py-1">
            <span className="text-[#747474]">Subtotal anterior</span>
            <span className="text-[#181818]" style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{subtotalActual}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-[#747474]">Subtotal nuevo</span>
            <span className="text-[#181818]" style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{subtotalNuevo}</span>
          </div>
        </div>
        <p className="text-[#747474] mb-5" style={{ fontSize: 12, lineHeight: 1.5 }}>
          Los precios en pesos no cambian; solo cambia su equivalencia en {moneda}. Al dar OK se aplica el tipo de cambio nuevo a esta propuesta.
        </p>
        <button
          onClick={onAceptar}
          disabled={guardando}
          className="w-full px-4 py-2.5 rounded-lg bg-[#0176D3] text-white hover:bg-[#014486] transition-colors disabled:opacity-60"
          style={{ fontSize: 13, fontWeight: 700 }}
          autoFocus
        >
          {guardando ? 'Actualizando…' : 'OK'}
        </button>
      </div>
    </div>
  );
}
