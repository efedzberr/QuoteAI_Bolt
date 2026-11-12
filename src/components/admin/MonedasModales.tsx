import { useCallback, useEffect, useState } from 'react';
import { Loader2, Sparkles, X, RotateCcw } from 'lucide-react';
import {
  cargarHistorialTc,
  consultarFuentesTc,
  fechaTc,
  fijarTipoCambio,
  formatoTc,
  nombreFuenteTc,
  type CotizacionFuente,
  type HistorialTc,
  type SugerenciaTc,
} from '../../lib/monedas';
import { claseCampo } from './pdf/pdfEditorUtil';

const botonPrimario =
  'inline-flex items-center justify-center gap-2 h-9 px-3 bg-brand text-white font-semibold text-sm rounded-lg hover:bg-brand-deep disabled:opacity-60 disabled:cursor-not-allowed transition-colors';
const botonSecundario =
  'inline-flex items-center justify-center gap-2 h-9 px-3 bg-white text-ink-soft font-semibold text-sm rounded-lg border border-rule hover:bg-rule-soft disabled:opacity-60 disabled:cursor-not-allowed transition-colors';

function Marco({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-rule">
          <h3 className="text-base font-bold text-ink">{titulo}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-ink-faint hover:bg-rule-soft hover:text-ink transition-colors" aria-label="Cerrar">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function motivoFalla(error: string | null): string {
  if (error === 'not_configured') return 'No configurada (falta el token de Banxico)';
  if (error === 'unsupported') return 'No publica esta moneda';
  return 'No disponible en este momento';
}

const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

interface FuentesProps {
  codigo: string;
  onClose: () => void;
  onGuardado: () => void;
  onToast: (message: string, type: 'success' | 'error') => void;
}

export function ModalFuentesTc({ codigo, onClose, onGuardado, onToast }: FuentesProps) {
  const [cargando, setCargando] = useState(true);
  const [sugerencia, setSugerencia] = useState<SugerenciaTc | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [manual, setManual] = useState('');

  const consultar = useCallback(async () => {
    setCargando(true);
    setSugerencia(await consultarFuentesTc(codigo));
    setCargando(false);
  }, [codigo]);

  useEffect(() => { consultar(); }, [consultar]);

  const guardar = async (valor: number, fuente: CotizacionFuente['source'] | 'manual', fecha: string | null) => {
    setGuardando(true);
    const error = await fijarTipoCambio(codigo, valor, fuente, fecha);
    setGuardando(false);
    if (error) { onToast(`No se pudo guardar: ${error}`, 'error'); return; }
    onToast(`Tipo de cambio de ${codigo} actualizado`, 'success');
    onGuardado();
  };

  const valorManual = Number(manual);
  const manualValido = manual.trim() !== '' && Number.isFinite(valorManual) && valorManual > 0;

  return (
    <Marco titulo={`Tipo de cambio de ${codigo}`} onClose={onClose}>
      {cargando ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-ink-faint">
          <Loader2 className="w-4 h-4 animate-spin" /> Consultando fuentes…
        </div>
      ) : !sugerencia ? (
        <div className="flex items-center justify-between gap-3 p-4 rounded-lg border border-warn/30 bg-warn-soft">
          <p className="text-sm font-semibold text-warn">No se pudieron consultar las fuentes</p>
          <button onClick={consultar} className={botonSecundario}><RotateCcw className="w-4 h-4" /> Reintentar</button>
        </div>
      ) : (
        <div className="space-y-2">
          {sugerencia.sources.map((s) => {
            const recomendada = sugerencia.advice?.recommended === s.source;
            return (
              <div
                key={s.source}
                className={`flex items-center justify-between gap-3 p-3 rounded-lg border ${s.ok ? 'border-rule bg-white' : 'border-rule bg-rule-soft'} ${recomendada ? 'ring-2 ring-violet-200' : ''}`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-semibold ${s.ok ? 'text-ink' : 'text-ink-faint'}`}>{nombreFuenteTc(s.source)}</span>
                    {recomendada && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-[11px] font-semibold">
                        <Sparkles className="w-3 h-3" /> Recomendada por IA
                      </span>
                    )}
                  </div>
                  {s.ok && s.rate ? (
                    <p className="text-sm text-ink mt-0.5 tabular-nums">
                      1 {codigo} = {formatoTc(s.rate)} MXN
                      {s.date ? <span className="text-ink-faint"> · {fechaTc(s.date)}</span> : null}
                    </p>
                  ) : (
                    <p className="text-xs text-ink-faint mt-0.5">{motivoFalla(s.error)}</p>
                  )}
                </div>
                {s.ok && s.rate ? (
                  <button disabled={guardando} onClick={() => guardar(s.rate as number, s.source, s.date)} className={botonSecundario}>
                    Usar este valor
                  </button>
                ) : null}
              </div>
            );
          })}
          {sugerencia.advice && (
            <div className="mt-3 p-3 rounded-lg bg-violet-50 border border-violet-100 text-sm text-ink-soft leading-relaxed">
              {sugerencia.advice.explanation}
            </div>
          )}
        </div>
      )}

      <div className="mt-5 pt-4 border-t border-rule">
        <label className="block text-[11px] font-semibold text-ink-soft uppercase tracking-wide mb-1">
          Otro valor (pesos por 1 {codigo})
        </label>
        <div className="flex gap-2">
          <input type="number" min="0" step="0.0001" value={manual} onChange={(e) => setManual(e.target.value)} className={claseCampo} placeholder="0.0000" />
          <button disabled={!manualValido || guardando} onClick={() => guardar(valorManual, 'manual', hoy())} className={`${botonPrimario} whitespace-nowrap`}>
            {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Guardar valor manual
          </button>
        </div>
        {manual.trim() !== '' && !manualValido && <p className="text-xs text-warn mt-1">El valor debe ser mayor a 0.</p>}
      </div>
    </Marco>
  );
}

export function ModalHistorialTc({ codigo, onClose }: { codigo: string; onClose: () => void }) {
  const [filas, setFilas] = useState<HistorialTc[] | null>(null);

  useEffect(() => {
    let vivo = true;
    cargarHistorialTc(codigo).then((r) => { if (vivo) setFilas(r); });
    return () => { vivo = false; };
  }, [codigo]);

  return (
    <Marco titulo={`Historial de ${codigo}`} onClose={onClose}>
      {filas === null ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-ink-faint">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
        </div>
      ) : filas.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-faint">Todavía no hay cambios registrados.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-ink-faint border-b border-rule">
              <th className="py-2 pr-3 font-semibold">Fecha y hora</th>
              <th className="py-2 pr-3 font-semibold text-right">Tipo de cambio</th>
              <th className="py-2 pr-3 font-semibold">Fuente</th>
              <th className="py-2 pr-3 font-semibold">Fecha de la fuente</th>
              <th className="py-2 font-semibold">Origen</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((h) => (
              <tr key={h.id} className="border-b border-rule last:border-0">
                <td className="py-2 pr-3 text-ink-soft whitespace-nowrap">{new Date(h.created_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}</td>
                <td className="py-2 pr-3 text-ink text-right tabular-nums font-semibold">{formatoTc(h.tipo_cambio)}</td>
                <td className="py-2 pr-3 text-ink-soft">{nombreFuenteTc(h.fuente)}</td>
                <td className="py-2 pr-3 text-ink-soft">{fechaTc(h.fecha_fuente)}</td>
                <td className="py-2 text-ink-soft">{h.es_auto ? 'Automático' : 'Administrador'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Marco>
  );
}
