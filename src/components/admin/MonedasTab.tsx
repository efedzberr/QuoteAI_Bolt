import { useCallback, useEffect, useState } from 'react';
import { Coins, Loader2, RefreshCw, Save, AlertTriangle, Search, History } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAppSettings } from '../../hooks/useAppSettings';
import {
  actualizarMoneda,
  actualizarTiposDeCambioAhora,
  cargarMonedas,
  fechaTc,
  formatoTc,
  nombreFuenteTc,
  FUENTES_TC,
  type FuenteTc,
  type Moneda,
} from '../../lib/monedas';
import { claseCampo } from './pdf/pdfEditorUtil';
import { ModalFuentesTc, ModalHistorialTc } from './MonedasModales';

interface Props {
  onToast: (message: string, type: 'success' | 'error') => void;
}

const botonPrimario =
  'inline-flex items-center justify-center gap-2 h-9 px-3 bg-brand text-white font-semibold text-sm rounded-lg hover:bg-brand-deep disabled:opacity-60 disabled:cursor-not-allowed transition-colors';
const botonSecundario =
  'inline-flex items-center justify-center gap-2 h-8 px-2.5 bg-white text-ink-soft font-semibold text-xs rounded-lg border border-rule hover:bg-rule-soft disabled:opacity-60 disabled:cursor-not-allowed transition-colors';

function Interruptor({ activo, onChange, disabled, etiqueta }: { activo: boolean; onChange: (v: boolean) => void; disabled?: boolean; etiqueta: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      disabled={disabled}
      onClick={() => onChange(!activo)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${activo ? 'bg-brand' : 'bg-gray-300'}`}
    >
      <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${activo ? 'translate-x-4' : ''}`} />
    </button>
  );
}

export default function MonedasTab({ onToast }: Props) {
  const { tcAutoHabilitado, tcUmbralAvisoPct, loading: cargandoAjustes, refresh } = useAppSettings();
  const [monedas, setMonedas] = useState<Moneda[]>([]);
  const [cargando, setCargando] = useState(true);
  const [umbral, setUmbral] = useState('');
  const [guardandoAuto, setGuardandoAuto] = useState(false);
  const [guardandoUmbral, setGuardandoUmbral] = useState(false);
  const [actualizando, setActualizando] = useState(false);
  const [guardandoFila, setGuardandoFila] = useState<string | null>(null);
  const [fuentesDe, setFuentesDe] = useState<string | null>(null);
  const [historialDe, setHistorialDe] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    setMonedas(await cargarMonedas());
    setCargando(false);
  }, []);

  useEffect(() => { recargar(); }, [recargar]);
  useEffect(() => { if (!cargandoAjustes) setUmbral(String(tcUmbralAvisoPct)); }, [cargandoAjustes, tcUmbralAvisoPct]);

  const cambiarAuto = async (valor: boolean) => {
    setGuardandoAuto(true);
    const { error } = await supabase.from('app_settings').update({ tc_auto_habilitado: valor }).eq('id', 1);
    if (error) onToast(`Error al guardar: ${error.message}`, 'error');
    else { await refresh(); onToast(valor ? 'Actualización diaria encendida' : 'Actualización diaria apagada', 'success'); }
    setGuardandoAuto(false);
  };

  const valorUmbral = Number(umbral);
  const umbralValido = umbral.trim() !== '' && Number.isFinite(valorUmbral) && valorUmbral >= 0 && valorUmbral <= 20 && /^\d+(\.\d{1,2})?$/.test(umbral.trim());

  const guardarUmbral = async () => {
    if (!umbralValido) return;
    setGuardandoUmbral(true);
    const { error } = await supabase.from('app_settings').update({ tc_umbral_aviso_pct: valorUmbral }).eq('id', 1);
    if (error) onToast(`Error al guardar: ${error.message}`, 'error');
    else { await refresh(); onToast('Umbral de aviso guardado', 'success'); }
    setGuardandoUmbral(false);
  };

  const actualizarAhora = async () => {
    setActualizando(true);
    const r = await actualizarTiposDeCambioAhora();
    setActualizando(false);
    if (!r) onToast('No se pudo actualizar', 'error');
    else if (r.failed > 0) onToast(`${r.failed} monedas no se pudieron actualizar`, 'error');
    else onToast(`Tipos de cambio actualizados: ${r.updated}`, 'success');
    await recargar();
  };

  const cambiarFila = async (codigo: string, cambios: Parameters<typeof actualizarMoneda>[1]) => {
    setGuardandoFila(codigo);
    const error = await actualizarMoneda(codigo, cambios);
    setGuardandoFila(null);
    if (error) { onToast(`Error al guardar: ${error}`, 'error'); return; }
    setMonedas((prev) => prev.map((m) => (m.codigo === codigo ? { ...m, ...cambios } : m)));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold text-ink">
          <Coins className="w-5 h-5 text-brand" /> Monedas y tipo de cambio
        </h2>
        <p className="text-sm text-ink-faint mt-1 max-w-3xl">
          Los precios siempre se guardan en pesos. La moneda solo cambia cómo se muestra la propuesta y su PDF, usando el tipo de cambio de aquí.
        </p>
      </div>

      <section className="bg-white rounded-card border border-rule shadow-sm">
        <div className="px-5 py-4 border-b border-rule">
          <h3 className="text-base font-bold text-ink">Actualización automática</h3>
        </div>
        <div className="px-5 py-4 space-y-5">
          <div className="flex items-start gap-3">
            <Interruptor activo={tcAutoHabilitado} onChange={cambiarAuto} disabled={guardandoAuto || cargandoAjustes} etiqueta="Actualizar el tipo de cambio todos los días" />
            <div>
              <p className="text-sm font-semibold text-ink">Actualizar el tipo de cambio todos los días</p>
              <p className="text-xs text-ink-faint mt-0.5 max-w-2xl">
                Todos los días a las 7:00 a.m. se actualizan las monedas activas que tengan el automático encendido. Apagado, el tipo de cambio solo cambia cuando un administrador lo actualiza aquí.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-ink mb-1">Actualizar la propuesta cuando el tipo de cambio varíe (%) o más</label>
            <div className="flex items-center gap-2 max-w-xs">
              <input type="number" min="0" max="20" step="0.01" value={umbral} onChange={(e) => setUmbral(e.target.value)} className={claseCampo} />
              <button onClick={guardarUmbral} disabled={!umbralValido || guardandoUmbral || Number(umbral) === tcUmbralAvisoPct} className={botonPrimario}>
                {guardandoUmbral ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar
              </button>
            </div>
            {umbral.trim() !== '' && !umbralValido && <p className="text-xs text-warn mt-1">Escribe un valor entre 0 y 20, con hasta 2 decimales.</p>}
            <p className="text-xs text-ink-faint mt-1 max-w-2xl">
              Al abrir una propuesta en otra moneda que aún no tiene PDF, si el tipo de cambio vigente difiere en este porcentaje o más del que tiene la propuesta, se le avisa al ejecutivo y se actualiza al dar OK. Diferencias menores no cambian la propuesta.
            </p>
          </div>

          <button onClick={actualizarAhora} disabled={actualizando} className={botonPrimario}>
            {actualizando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Actualizar ahora
          </button>
        </div>
      </section>

      <section className="bg-white rounded-card border border-rule shadow-sm">
        <div className="px-5 py-4 border-b border-rule">
          <h3 className="text-base font-bold text-ink">Monedas</h3>
        </div>
        {cargando ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-ink-faint">
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando monedas…
          </div>
        ) : monedas.length === 0 ? (
          <p className="py-12 text-center text-sm text-ink-faint">No hay monedas registradas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-ink-faint border-b border-rule">
                  <th className="px-5 py-2.5 font-semibold">Moneda</th>
                  <th className="px-3 py-2.5 font-semibold">Activa</th>
                  <th className="px-3 py-2.5 font-semibold">Tipo de cambio</th>
                  <th className="px-3 py-2.5 font-semibold">Fuente y fecha</th>
                  <th className="px-3 py-2.5 font-semibold">Automático</th>
                  <th className="px-5 py-2.5 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {monedas.map((m) => {
                  const ocupada = guardandoFila === m.codigo;
                  const sinTc = !m.es_base && (m.tipo_cambio === null || !(m.tipo_cambio > 0));
                  return (
                    <tr key={m.codigo} className="border-b border-rule last:border-0 align-top hover:bg-rule-soft/50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-ink">{m.codigo}</span>
                          {m.es_base && <span className="px-1.5 py-0.5 rounded bg-brand-soft text-brand text-[10px] font-semibold uppercase">Base</span>}
                        </div>
                        <p className="text-xs text-ink-faint">{m.nombre}</p>
                        {m.activa && sinTc && (
                          <p className="flex items-start gap-1 text-xs text-warn mt-1 max-w-[220px]">
                            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
                            Esta moneda no aparece en las propuestas hasta que tenga tipo de cambio.
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <Interruptor activo={m.activa} disabled={m.es_base || ocupada} onChange={(v) => cambiarFila(m.codigo, { activa: v })} etiqueta={`Activar ${m.codigo}`} />
                      </td>
                      <td className="px-3 py-3 tabular-nums whitespace-nowrap">
                        {m.es_base ? (
                          <span className="text-ink">1.0000</span>
                        ) : m.tipo_cambio !== null ? (
                          <span className="text-ink font-semibold">1 {m.codigo} = {formatoTc(m.tipo_cambio)} MXN</span>
                        ) : (
                          <span className="text-warn font-semibold">Sin tipo de cambio</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {!m.es_base && m.tc_fuente ? (
                          <>
                            <p className="text-ink-soft">{nombreFuenteTc(m.tc_fuente)}{m.tc_fecha ? ` · ${fechaTc(m.tc_fecha)}` : ''}</p>
                            <p className="text-xs text-ink-faint">{m.tc_es_auto ? 'Automático' : 'Capturado por un administrador'}</p>
                          </>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        {!m.es_base && (
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <Interruptor activo={m.auto_actualizar} disabled={ocupada} onChange={(v) => cambiarFila(m.codigo, { auto_actualizar: v })} etiqueta={`Automático ${m.codigo}`} />
                              <select
                                value={m.auto_fuente}
                                disabled={ocupada}
                                onChange={(e) => cambiarFila(m.codigo, { auto_fuente: e.target.value as FuenteTc })}
                                className="h-8 px-2 border border-rule rounded-lg text-xs text-ink bg-white focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft"
                              >
                                {FUENTES_TC.map((f) => <option key={f} value={f}>{nombreFuenteTc(f)}</option>)}
                              </select>
                            </div>
                            {m.auto_fuente === 'banxico' && m.codigo !== 'USD' && m.codigo !== 'EUR' && (
                              <p className="text-xs text-ink-faint max-w-[220px]">Banxico solo publica USD y EUR; se usará Mercado</p>
                            )}
                            {m.auto_fuente === 'dof' && m.codigo !== 'USD' && (
                              <p className="text-xs text-ink-faint max-w-[220px]">El DOF solo publica el dólar; se usará Mercado</p>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {!m.es_base && (
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setFuentesDe(m.codigo)} className={botonSecundario}><Search className="w-3.5 h-3.5" /> Consultar fuentes</button>
                            <button onClick={() => setHistorialDe(m.codigo)} className={botonSecundario}><History className="w-3.5 h-3.5" /> Historial</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {fuentesDe && (
        <ModalFuentesTc
          codigo={fuentesDe}
          onClose={() => setFuentesDe(null)}
          onGuardado={() => { setFuentesDe(null); recargar(); }}
          onToast={onToast}
        />
      )}
      {historialDe && <ModalHistorialTc codigo={historialDe} onClose={() => setHistorialDe(null)} />}
    </div>
  );
}
