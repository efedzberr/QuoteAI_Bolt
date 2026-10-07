import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, Loader2, Search, X } from 'lucide-react';
import {
  buscarCuentasSalesforce,
  cambiarClienteCotizacion,
  type CuentaSalesforce,
  type ResumenCambioCliente,
} from '../../lib/encabezadoCotizacion';

interface CambiarClienteModalProps {
  referencia: string;
  clienteActual: string;
  userEmail: string;
  onClose: () => void;
  /** Se llama cuando el cambio ya quedó guardado. `cuenta` es null si el cliente se escribió a mano. */
  onCambiado: (resumen: ResumenCambioCliente, cuenta: CuentaSalesforce | null) => void;
}

interface Eleccion {
  cliente: string;
  cuenta: CuentaSalesforce | null;
}

function moneda(valor: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor || 0);
}

/**
 * Cambio de cliente de una cotización en dos pasos:
 * 1. Buscar la cuenta en Salesforce (o usar el nombre escrito, sin cuenta).
 * 2. Ver cómo quedan el grupo y los precios, y confirmar.
 */
export default function CambiarClienteModal({ referencia, clienteActual, userEmail, onClose, onCambiado }: CambiarClienteModalProps) {
  const [texto, setTexto] = useState('');
  const [cuentas, setCuentas] = useState<CuentaSalesforce[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [busquedaHecha, setBusquedaHecha] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);
  const [eleccion, setEleccion] = useState<Eleccion | null>(null);
  const [resumen, setResumen] = useState<ResumenCambioCliente | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const esperaRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busquedaRef = useRef(0);

  useEffect(() => () => {
    if (esperaRef.current) clearTimeout(esperaRef.current);
  }, []);

  const buscar = useCallback(async (consulta: string) => {
    const limpio = consulta.trim();
    if (limpio.length < 2) {
      setCuentas([]);
      setBusquedaHecha(false);
      return;
    }
    const turno = ++busquedaRef.current;
    setBuscando(true);
    setErrorBusqueda(null);
    try {
      const encontradas = await buscarCuentasSalesforce(userEmail, limpio);
      if (turno !== busquedaRef.current) return;
      setCuentas(encontradas);
    } catch (e: any) {
      if (turno !== busquedaRef.current) return;
      setCuentas([]);
      setErrorBusqueda(e?.message || 'No se pudo consultar Salesforce.');
    } finally {
      if (turno === busquedaRef.current) {
        setBuscando(false);
        setBusquedaHecha(true);
      }
    }
  }, [userEmail]);

  const handleTexto = (valor: string) => {
    const mayus = valor.toLocaleUpperCase('es-MX');
    setTexto(mayus);
    setBusquedaHecha(false);
    if (esperaRef.current) clearTimeout(esperaRef.current);
    esperaRef.current = setTimeout(() => buscar(mayus), 500);
  };

  const elegir = async (nueva: Eleccion) => {
    setEleccion(nueva);
    setResumen(null);
    setError(null);
    setCalculando(true);
    const { resumen: calculado, error: mensaje } = await cambiarClienteCotizacion(referencia, nueva.cliente, nueva.cuenta, false);
    setCalculando(false);
    if (mensaje || !calculado) {
      setError(mensaje || 'No se pudo calcular el cambio.');
      return;
    }
    setResumen(calculado);
  };

  const volverABuscar = () => {
    if (aplicando) return;
    setEleccion(null);
    setResumen(null);
    setError(null);
  };

  const confirmar = async () => {
    if (!eleccion || !resumen || aplicando) return;
    setAplicando(true);
    setError(null);
    const { resumen: aplicado, error: mensaje } = await cambiarClienteCotizacion(referencia, eleccion.cliente, eleccion.cuenta, true);
    setAplicando(false);
    if (mensaje || !aplicado) {
      setError(mensaje || 'No se pudo cambiar el cliente.');
      return;
    }
    onCambiado(aplicado, eleccion.cuenta);
  };

  const textoLibre = texto.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" style={{ fontFamily: "'Manrope', sans-serif" }}>
      <div className="w-full max-w-[560px] bg-white rounded-xl shadow-xl border border-[#E5E5E5]">
        <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-[#F0F0F0]">
          <div>
            <h3 className="text-[#181818]" style={{ fontSize: 17, fontWeight: 700 }}>Cambiar cliente</h3>
            <p className="mt-0.5 text-[#747474]" style={{ fontSize: 12 }}>
              Cliente actual: <span className="text-[#444444]" style={{ fontWeight: 600 }}>{clienteActual || '—'}</span>
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={aplicando} title="Cerrar" className="p-1.5 rounded-md text-[#747474] hover:bg-[#F3F3F3] disabled:opacity-50">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!eleccion ? (
          <div className="px-6 py-5">
            <label className="block uppercase mb-2 text-[#747474]" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em' }}>
              Nuevo cliente
            </label>
            <div className="relative">
              <input
                type="text"
                value={texto}
                autoFocus
                onChange={(e) => handleTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (esperaRef.current) clearTimeout(esperaRef.current);
                    buscar(texto);
                  }
                }}
                placeholder="Escribe para buscar en Salesforce"
                className="w-full px-3.5 py-3 pr-10 border border-[#E5E5E5] rounded-lg text-[#181818] placeholder:text-[#A3A3A3] focus:outline-none focus:border-[#0176D3] focus:ring-[3px] focus:ring-[#EAF5FE]"
                style={{ fontSize: 14 }}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {buscando ? <Loader2 className="w-4 h-4 text-[#0176D3] animate-spin" /> : <Search className="w-4 h-4 text-[#A3A3A3]" />}
              </div>
            </div>

            <div className="mt-3 border border-[#E5E5E5] rounded-lg max-h-[260px] overflow-y-auto">
              {textoLibre.length < 2 ? (
                <p className="px-4 py-3 text-[#747474]" style={{ fontSize: 13 }}>Escribe al menos 2 letras del nombre del cliente.</p>
              ) : buscando || !busquedaHecha ? (
                <p className="px-4 py-3 flex items-center gap-2 text-[#0176D3]" style={{ fontSize: 13 }}>
                  <Loader2 className="w-4 h-4 animate-spin" /> Buscando en Salesforce...
                </p>
              ) : (
                <>
                  {errorBusqueda && (
                    <p className="px-4 py-3 text-[#B86C00] border-b border-[#F0F0F0]" style={{ fontSize: 13 }}>{errorBusqueda}</p>
                  )}
                  {!errorBusqueda && cuentas.length === 0 && (
                    <p className="px-4 py-3 text-[#747474] border-b border-[#F0F0F0]" style={{ fontSize: 13 }}>No se encontraron cuentas en Salesforce.</p>
                  )}
                  {cuentas.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => elegir({ cliente: (c.name || '').toLocaleUpperCase('es-MX'), cuenta: c })}
                      className="w-full text-left px-4 py-2.5 hover:bg-[#EAF5FE] transition-colors border-b border-[#F0F0F0]"
                    >
                      <p className="text-[#181818]" style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</p>
                      <p className="text-[#747474]" style={{ fontSize: 11 }}>
                        No. {c.noCliente || '—'}{c.calle ? ` · ${c.calle}` : ''}{c.estado ? `, ${c.estado}` : ''}
                      </p>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => elegir({ cliente: textoLibre, cuenta: null })}
                    className="w-full text-left px-4 py-2.5 hover:bg-[#F3F3F3] transition-colors"
                  >
                    <p className="text-[#444444]" style={{ fontSize: 13, fontWeight: 600 }}>Usar «{textoLibre}» sin cuenta de Salesforce</p>
                    <p className="text-[#747474]" style={{ fontSize: 11 }}>Sin número de cliente: la cotización usa el grupo General.</p>
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="px-6 py-5">
            <div className="flex items-center gap-2 flex-wrap text-[#181818]" style={{ fontSize: 14, fontWeight: 700 }}>
              <span className="text-[#747474]" style={{ fontWeight: 600 }}>{clienteActual || '—'}</span>
              <ArrowRight className="w-4 h-4 text-[#747474]" />
              <span>{eleccion.cliente}</span>
            </div>
            <p className="mt-0.5 text-[#747474]" style={{ fontSize: 12 }}>
              {eleccion.cuenta ? `Cuenta de Salesforce · No. ${eleccion.cuenta.noCliente || '—'}` : 'Sin cuenta de Salesforce'}
            </p>

            {calculando && (
              <p className="mt-5 flex items-center gap-2 text-[#0176D3]" style={{ fontSize: 13 }}>
                <Loader2 className="w-4 h-4 animate-spin" /> Calculando los precios del nuevo cliente...
              </p>
            )}

            {resumen && (
              <>
                <div className="mt-4 border border-[#E5E5E5] rounded-lg divide-y divide-[#F0F0F0]">
                  <FilaResumen etiqueta="Grupo de precios" anterior={resumen.grupo_anterior || '—'} nuevo={resumen.grupo} />
                  <FilaResumen
                    etiqueta="Líneas que cambian de precio"
                    nuevo={`${resumen.lineas_con_cambio} de ${resumen.lineas}`}
                  />
                  <FilaResumen etiqueta="Subtotal" anterior={moneda(resumen.subtotal_anterior)} nuevo={moneda(resumen.subtotal_nuevo)} />
                </div>

                <div className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-[#FEF4E5] text-[#8C4B02]" style={{ fontSize: 12, lineHeight: 1.45 }}>
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <p>Se recalcula el precio de todas las líneas con producto del catálogo, incluidas las que tenían un precio capturado a mano.</p>
                    {resumen.lineas_sin_precio > 0 && (
                      <p className="mt-1" style={{ fontWeight: 700 }}>
                        {resumen.lineas_sin_precio} {resumen.lineas_sin_precio === 1 ? 'línea queda' : 'líneas quedan'} sin precio para este cliente. Revisa esos precios antes de validar.
                      </p>
                    )}
                    {resumen.regresa_a_validar && (
                      <p className="mt-1">La cotización ya estaba validada: regresa a validación para que la revises con los precios nuevos.</p>
                    )}
                  </div>
                </div>
              </>
            )}

            {error && (
              <p className="mt-4 px-3 py-2.5 rounded-lg bg-[#FEECEC] text-[#BA0517]" style={{ fontSize: 13, fontWeight: 600 }}>{error}</p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-[#F0F0F0]">
          {eleccion ? (
            <>
              <button
                type="button"
                onClick={volverABuscar}
                disabled={aplicando}
                className="px-5 py-2.5 border border-[#E5E5E5] text-[#444444] rounded-lg hover:bg-[#F3F3F3] disabled:opacity-50"
                style={{ fontSize: 14, fontWeight: 600 }}
              >
                Elegir otro cliente
              </button>
              <button
                type="button"
                onClick={confirmar}
                disabled={!resumen || aplicando}
                className={`px-5 py-2.5 rounded-lg flex items-center gap-2 ${
                  resumen && !aplicando ? 'bg-[#0176D3] text-white hover:bg-[#014486]' : 'bg-[#D1D5DB] text-[#747474] cursor-not-allowed'
                }`}
                style={{ fontSize: 14, fontWeight: 700 }}
              >
                {aplicando && <Loader2 className="w-4 h-4 animate-spin" />}
                {aplicando ? 'Cambiando...' : 'Cambiar cliente y recalcular'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border border-[#E5E5E5] text-[#444444] rounded-lg hover:bg-[#F3F3F3]"
              style={{ fontSize: 14, fontWeight: 600 }}
            >
              Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function FilaResumen({ etiqueta, anterior, nuevo }: { etiqueta: string; anterior?: string; nuevo: string }) {
  const cambia = anterior !== undefined && anterior !== nuevo;
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5">
      <span className="text-[#747474]" style={{ fontSize: 12, fontWeight: 600 }}>{etiqueta}</span>
      <span className="flex items-center gap-2 text-[#181818]" style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
        {cambia && (
          <>
            <span className="text-[#747474]" style={{ fontWeight: 500 }}>{anterior}</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#747474]" />
          </>
        )}
        {nuevo}
      </span>
    </div>
  );
}
