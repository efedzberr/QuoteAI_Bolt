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
  onActualizar: () => void;
  onConservar: () => void;
}

/** Aviso al abrir una propuesta: el tipo de cambio vigente ya no es el que tiene la propuesta. */
export default function AvisoTipoCambioModal({ moneda, anterior, vigente, fuente, fecha, subtotalActual, subtotalNuevo, guardando, onActualizar, onConservar }: Props) {
  const variacion = variacionTc(anterior, vigente);
  const subio = variacion > 0;
  const Icono = subio ? TrendingUp : TrendingDown;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full mx-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ backgroundColor: '#FEF3C7' }}>
            <Icono className="w-5 h-5" style={{ color: '#B86C00' }} />
          </div>
          <h3 className="text-[#181818]" style={{ fontSize: 17, fontWeight: 700 }}>Cambió el tipo de cambio</h3>
        </div>
        <p className="text-[#444] mb-4" style={{ fontSize: 13, lineHeight: 1.55 }}>
          Esta propuesta está en {moneda} con un tipo de cambio que ya no es el vigente.
          El {moneda} {subio ? 'subió' : 'bajó'} <strong>{Math.abs(variacion).toFixed(2)}%</strong> frente al peso.
        </p>
        <div className="bg-[#F8F9FA] rounded-lg p-4 mb-4" style={{ fontSize: 13 }}>
          <div className="flex justify-between py-1">
            <span className="text-[#747474]">En la propuesta</span>
            <span className="text-[#181818]" style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>1 {moneda} = {formatoTc(anterior)} MXN</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-[#747474]">Vigente{fuente ? ` (${nombreFuenteTc(fuente)}${fecha ? `, ${fechaTc(fecha)}` : ''})` : ''}</span>
            <span className="text-[#181818]" style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>1 {moneda} = {formatoTc(vigente)} MXN</span>
          </div>
          <div className="border-t border-[#E5E5E5] my-2" />
          <div className="flex justify-between py-1">
            <span className="text-[#747474]">Subtotal actual</span>
            <span className="text-[#181818]" style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{subtotalActual}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-[#747474]">Subtotal si actualizas</span>
            <span className="text-[#181818]" style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{subtotalNuevo}</span>
          </div>
        </div>
        <p className="text-[#747474] mb-5" style={{ fontSize: 12, lineHeight: 1.5 }}>
          Los precios en pesos no cambian; solo cambia su equivalencia en {moneda}. ¿Quieres actualizar el tipo de cambio de esta propuesta?
        </p>
        <div className="flex gap-3">
          <button
            onClick={onConservar}
            disabled={guardando}
            className="flex-1 px-4 py-2.5 rounded-lg bg-[#E5E7EB] text-[#181818] hover:bg-[#D1D5DB] transition-colors"
            style={{ fontSize: 13, fontWeight: 700 }}
          >
            Conservar el actual
          </button>
          <button
            onClick={onActualizar}
            disabled={guardando}
            className="flex-1 px-4 py-2.5 rounded-lg bg-[#0176D3] text-white hover:bg-[#014486] transition-colors disabled:opacity-60"
            style={{ fontSize: 13, fontWeight: 700 }}
          >
            {guardando ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>
      </div>
    </div>
  );
}
