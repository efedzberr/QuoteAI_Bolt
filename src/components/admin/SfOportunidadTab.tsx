import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Cloud, Loader2, Save, RotateCcw, AlertTriangle, Database } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  SF_OPP_DEFAULTS,
  SF_OPP_NAME_MAX,
  SF_OPP_CIERRE_MAX_DIAS,
  CAMPOS_PLANTILLA,
  EJEMPLO_CAMPOS,
  ahoraMexico,
  formatoFecha,
  resolverPlantilla,
  normalizarConfig,
  type ClaveVariable,
  type ListaSf,
  type SfOportunidadConfig,
  type ValorLista,
} from '../../lib/sfOportunidad';
import { claseCampo } from './pdf/pdfEditorUtil';
import SfListasValores from './sf/SfListasValores';

interface Props {
  onToast: (message: string, type: 'success' | 'error') => void;
}

const botonPrimario =
  'inline-flex items-center justify-center gap-2 h-9 px-3 bg-brand text-white font-semibold text-sm rounded-lg hover:bg-brand-deep disabled:opacity-60 disabled:cursor-not-allowed transition-colors';
const botonSecundario =
  'inline-flex items-center justify-center gap-2 h-9 px-3 bg-white text-ink-soft font-semibold text-sm rounded-lg border border-rule hover:bg-rule-soft disabled:opacity-60 disabled:cursor-not-allowed transition-colors';

const mensajeDe = (e: unknown) => (e as { message?: string })?.message || String(e);

function diasValidos(v: string | number): number | null {
  const s = String(v).trim();
  if (!/^\d+$/.test(s)) return null;
  const n = parseInt(s, 10);
  return n >= 0 && n <= SF_OPP_CIERRE_MAX_DIAS ? n : null;
}

function fechaCierre(dias: number): string {
  const d = ahoraMexico();
  d.setDate(d.getDate() + dias);
  return formatoFecha(d, 'DD/MM/YYYY');
}

export default function SfOportunidadTab({ onToast }: Props) {
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [guardada, setGuardada] = useState<SfOportunidadConfig>(SF_OPP_DEFAULTS);
  const [borrador, setBorrador] = useState<SfOportunidadConfig>(SF_OPP_DEFAULTS);
  const [listas, setListas] = useState<ValorLista[]>([]);
  const [guardando, setGuardando] = useState(false);
  const nombreRef = useRef<HTMLInputElement>(null);

  const cargarListas = useCallback(async () => {
    const { data, error } = await supabase
      .from('sf_listas_valores')
      .select('id, lista, valor, etiqueta, orden, activo')
      .order('lista')
      .order('orden');
    if (error) throw error;
    setListas((data || []) as ValorLista[]);
  }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [{ data, error }] = await Promise.all([
          supabase.from('app_settings').select('sf_oportunidad_config').eq('id', 1).maybeSingle(),
          cargarListas(),
        ]);
        if (error) throw error;
        const config = normalizarConfig(data?.sf_oportunidad_config);
        if (!vivo) return;
        setGuardada(config);
        setBorrador(config);
      } catch (e) {
        if (vivo) setErrorCarga(mensajeDe(e));
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => { vivo = false; };
  }, [cargarListas]);

  const recargarListas = useCallback(async () => {
    try {
      await cargarListas();
    } catch (e) {
      onToast(`No se pudieron recargar las listas: ${mensajeDe(e)}`, 'error');
    }
  }, [cargarListas, onToast]);

  const activosDe = useCallback((lista: ListaSf) => listas.filter((v) => v.lista === lista && v.activo), [listas]);

  const hayCambios = JSON.stringify(borrador) !== JSON.stringify(guardada);
  const setVar = (k: ClaveVariable, valor: string | number) =>
    setBorrador((b) => ({ ...b, [k]: { ...b[k], valor } }));

  const plantilla = String(borrador.nombre.valor ?? '');
  const vistaNombre = useMemo(() => resolverPlantilla(plantilla, EJEMPLO_CAMPOS, ahoraMexico()), [plantilla]);
  const dias = diasValidos(borrador.cierre.valor);

  const insertarToken = (token: string) => {
    const input = nombreRef.current;
    const inicio = input?.selectionStart ?? plantilla.length;
    const fin = input?.selectionEnd ?? plantilla.length;
    const nuevo = plantilla.slice(0, inicio) + token + plantilla.slice(fin);
    setVar('nombre', nuevo);
    const cursor = inicio + token.length;
    requestAnimationFrame(() => {
      if (!nombreRef.current) return;
      nombreRef.current.focus();
      nombreRef.current.setSelectionRange(cursor, cursor);
    });
  };

  const guardar = async () => {
    const n = diasValidos(borrador.cierre.valor);
    if (n === null) {
      onToast(`La fecha de cierre debe ser un número entero de 0 a ${SF_OPP_CIERRE_MAX_DIAS} días.`, 'error');
      return;
    }
    if (!plantilla.trim()) {
      onToast('El nombre de la oportunidad no puede quedar vacío.', 'error');
      return;
    }
    const config: SfOportunidadConfig = {
      ...borrador,
      cierre: { ...borrador.cierre, valor: n },
      nombre: { ...borrador.nombre, valor: plantilla.trim() },
    };
    setGuardando(true);
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .update({ sf_oportunidad_config: config })
        .eq('id', 1)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('No se encontró la configuración o no tienes permiso para modificarla.');
      setGuardada(config);
      setBorrador(config);
      onToast('Variables de la oportunidad guardadas', 'success');
    } catch (e) {
      onToast(`Error al guardar: ${mensajeDe(e)}`, 'error');
    } finally {
      setGuardando(false);
    }
  };

  const restaurar = () => {
    if (!window.confirm('¿Cargar los valores de respaldo? No se guardarán hasta que presiones «Guardar variables».')) return;
    setBorrador(SF_OPP_DEFAULTS);
  };

  const encabezado = (
    <div className="mb-5">
      <h2 className="flex items-center gap-2 text-xl font-bold text-ink">
        <Cloud className="w-5 h-5 text-brand" /> Salesforce · Oportunidad
      </h2>
      <p className="text-sm text-ink-faint mt-1 max-w-3xl">
        Define con qué valores se crea la Oportunidad en Salesforce al enviar una cotización. Railway los lee al momento del envío.
        Si una variable no está configurada o su valor está inactivo, se envía el valor de respaldo.
      </p>
    </div>
  );

  if (cargando) {
    return (
      <div>
        {encabezado}
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-ink-faint">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando la configuración…
        </div>
      </div>
    );
  }

  if (errorCarga) {
    return (
      <div>
        {encabezado}
        <div className="flex items-start gap-3 p-4 rounded-card border border-warn/30 bg-warn-soft">
          <Database className="w-5 h-5 text-warn flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-warn">Falta ejecutar la migración 20261009120000_sf_oportunidad_config.sql</p>
            <p className="text-xs text-ink-soft mt-1 break-words">Detalle: {errorCarga}</p>
          </div>
        </div>
      </div>
    );
  }

  const selectLista = (k: 'etapa' | 'pronostico' | 'probabilidad') => {
    const activos = activosDe(k);
    const valor = String(borrador[k].valor ?? '');
    const existe = activos.some((v) => v.valor === valor);
    const texto = (v: ValorLista) => v.etiqueta || (k === 'probabilidad' ? `${v.valor}%` : v.valor);
    return (
      <div className="space-y-1">
        <select value={valor} onChange={(e) => setVar(k, e.target.value)} className={claseCampo}>
          {!existe && <option value={valor}>{valor ? `${k === 'probabilidad' ? `${valor}%` : valor} (inactivo)` : '— Sin valor —'}</option>}
          {activos.map((v) => (
            <option key={v.id} value={v.valor}>{texto(v)}</option>
          ))}
        </select>
        {!existe && (
          <p className="flex items-start gap-1 text-xs text-warn">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
            Valor inactivo o inexistente — se enviará el respaldo ({SF_OPP_DEFAULTS[k].valor}
            {k === 'probabilidad' ? '%' : ''})
          </p>
        )}
      </div>
    );
  };

  const vistaLista = (k: 'etapa' | 'pronostico' | 'probabilidad') => {
    const v = String(borrador[k].valor ?? '');
    return k === 'probabilidad' ? `${v}%` : v;
  };

  return (
    <div className="space-y-6">
      {encabezado}

      <section className="bg-white rounded-card border border-rule shadow-sm">
        <div className="px-5 py-4 border-b border-rule">
          <h3 className="text-base font-bold text-ink">Variables de la oportunidad</h3>
          <p className="text-xs text-ink-faint mt-0.5">La vista previa usa una cotización de ejemplo.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-left text-[11px] font-semibold text-ink-soft uppercase tracking-wide bg-rule-soft">
                <th className="px-5 py-2.5 w-[200px]">Variable</th>
                <th className="px-3 py-2.5 w-[180px]">Campo en Salesforce</th>
                <th className="px-3 py-2.5">Valor</th>
                <th className="px-5 py-2.5 w-[220px]">Vista previa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule-soft">
              <Renglon variable="Etapa" campo="StageName" vista={vistaLista('etapa')}>{selectLista('etapa')}</Renglon>
              <Renglon variable="Categoría de pronóstico" campo="ForecastCategoryName" vista={vistaLista('pronostico')}>
                {selectLista('pronostico')}
              </Renglon>
              <Renglon variable="Probabilidad" campo="Probability" vista={vistaLista('probabilidad')}>
                {selectLista('probabilidad')}
              </Renglon>
              <Renglon
                variable="Fecha de cierre"
                campo="CloseDate"
                vista={dias === null ? <span className="text-warn">Número no válido</span> : fechaCierre(dias)}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={SF_OPP_CIERRE_MAX_DIAS}
                    step={1}
                    value={String(borrador.cierre.valor)}
                    onChange={(e) => setVar('cierre', e.target.value === '' ? '' : e.target.value)}
                    className={`${claseCampo} !w-24`}
                  />
                  <span className="text-xs text-ink-faint">Hoy + N días (horario de México)</span>
                </div>
              </Renglon>
              <Renglon variable="Monto" campo="Amount" vista="Suma de las líneas validadas">
                <select disabled value="total" className={`${claseCampo} disabled:bg-rule-soft disabled:text-ink-soft`}>
                  <option value="total">Total de la cotización</option>
                </select>
              </Renglon>
              <tr className="align-top">
                <td className="px-5 py-3 font-semibold text-ink">Nombre de la oportunidad</td>
                <td className="px-3 py-3"><code className="font-mono text-xs text-ink-soft">Name</code></td>
                <td className="px-3 py-3 pr-5" colSpan={2}>
                  <input
                    ref={nombreRef}
                    value={plantilla}
                    onChange={(e) => setVar('nombre', e.target.value)}
                    className={`${claseCampo} font-mono`}
                    placeholder="{referencia} - {cliente:40}"
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-semibold text-ink-soft mr-1">Insertar campo:</span>
                    {CAMPOS_PLANTILLA.map((c) => (
                      <button
                        key={c.token}
                        type="button"
                        onClick={() => insertarToken(c.token)}
                        title={c.token}
                        className="h-7 px-2.5 rounded-full border border-rule bg-white text-xs text-ink-soft hover:border-brand hover:text-brand hover:bg-brand-soft transition-colors"
                      >
                        {c.etiqueta}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-ink-faint">
                    Escribe texto libre y agrega campos. <code className="font-mono">{'{cliente:40}'}</code> recorta a 40 caracteres. Los campos vacíos se omiten.
                  </p>
                  <div className="mt-3 p-3 rounded-lg bg-rule-soft border border-rule">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <span className="text-[11px] font-semibold text-ink-soft uppercase tracking-wide">Vista previa</span>
                      <span className="text-[11px] text-ink-faint tabular-nums">{vistaNombre.length} / {SF_OPP_NAME_MAX} caracteres</span>
                    </div>
                    {vistaNombre ? (
                      <p className="text-sm font-semibold text-ink break-words">{vistaNombre}</p>
                    ) : (
                      <p className="flex items-center gap-1 text-sm text-warn">
                        <AlertTriangle className="w-3.5 h-3.5" /> La plantilla quedó vacía; se usará el nombre de respaldo.
                      </p>
                    )}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 px-5 py-3 border-t border-rule bg-rule-soft/50 rounded-b-card">
          {hayCambios && <span className="mr-auto text-xs font-semibold text-warn">Cambios sin guardar</span>}
          <button type="button" onClick={restaurar} disabled={guardando} className={botonSecundario}>
            <RotateCcw className="w-4 h-4" /> Restaurar valores de respaldo
          </button>
          <button type="button" onClick={guardar} disabled={!hayCambios || guardando} className={botonPrimario}>
            {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar variables
          </button>
        </div>
      </section>

      <SfListasValores
        listas={listas}
        enUso={{
          etapa: String(guardada.etapa.valor),
          pronostico: String(guardada.pronostico.valor),
          probabilidad: String(guardada.probabilidad.valor),
        }}
        onRecargar={recargarListas}
        onToast={onToast}
      />
    </div>
  );
}

function Renglon({ variable, campo, vista, children }: { variable: string; campo: string; vista: ReactNode; children: ReactNode }) {
  return (
    <tr className="align-top">
      <td className="px-5 py-3 font-semibold text-ink">{variable}</td>
      <td className="px-3 py-3"><code className="font-mono text-xs text-ink-soft">{campo}</code></td>
      <td className="px-3 py-3">{children}</td>
      <td className="px-5 py-3 text-ink-soft">{vista}</td>
    </tr>
  );
}
