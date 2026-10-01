import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { RefreshCw, Download, Star, ChevronDown, Trash2, X, ArrowUpRight, ArrowDownRight, LayoutList, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { type AdminObjectDef, fieldMap } from '../../lib/objectCatalog';
import { fetchUsuariosVisibles } from '../../lib/seguridad';
import { guardarConsulta, leerConsulta, aplicarDrill, quitarDrill, type CriteriosEfectivos } from '../../lib/objectState';
import {
  type AnalisisConfig, type ResultadoAnalisis, type FilaAnalisis, type AnalisisGuardado, type Granularidad,
  GRANULARIDADES, PERIODOS, camposFecha, camposAgrupables, camposNumericos, configInicial, normalizarConfig, aplicarPreset,
  ejecutarAnalisis, resolverEfectivos, criteriosDrill, etiquetaPeriodoFila, etiquetaValor, etiquetaMedida, etiquetaPeriodo,
  etiquetaComparacion, formatoMedida, variacion, rangoFechasCorto, fechaHora, listarGuardados, guardarAnalisis, eliminarGuardado, exportarExcel,
} from '../../lib/analisis';

interface Props {
  def: AdminObjectDef;
  onIrARegistros: () => void;
  onToast: (message: string, type: 'success' | 'error') => void;
}

// Colores de la gráfica: una sola serie en el azul de la marca; el gris es contexto ("Otros", periodo anterior)
const AZUL = '#0176D3';
const GRIS = '#8E8E8E';
const REJILLA = '#EEEEEE';
const EJE = '#E5E5E5';
const TEXTO_EJE = '#747474';

// Ejes: 3 cifras significativas para que una marca en 1,950 diga «1.95 k» y no «2 k»
const compacto = (n: number) => new Intl.NumberFormat('es-MX', { notation: 'compact', maximumSignificantDigits: 3 }).format(n);
const entero = (n: number | null | undefined) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('es-MX'));
const recortar = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

interface Punto {
  key: string;
  etiqueta: string;
  valor: number;
  anterior: number | null;
  pct: number | null;
  fila: FilaAnalisis | null;
  esOtros: boolean;
  clic: boolean;
}

export default function ObjectAnalytics({ def, onIrARegistros, onToast }: Props) {
  const fm = useMemo(() => fieldMap(def), [def]);
  const [cfg, setCfg] = useState<AnalisisConfig>(() => normalizarConfig(def, leerConsulta(def.id)?.analisis ?? configInicial(def)));
  const [userId, setUserId] = useState<string | null>(null);
  const [ef, setEf] = useState<CriteriosEfectivos | null>(null);
  const [search, setSearch] = useState('');
  const [viewId, setViewId] = useState<string | null>(null);
  const [drill, setDrill] = useState<string | null>(null);
  const [res, setRes] = useState<ResultadoAnalisis | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usuarios, setUsuarios] = useState<Map<string, string>>(new Map());
  const [guardados, setGuardados] = useState<AnalisisGuardado[]>([]);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [guardarAbierto, setGuardarAbierto] = useState(false);
  const [nombre, setNombre] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [tick, setTick] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const seqRef = useRef(0);
  const listoRef = useRef(false);

  // ---------- inicio: filtros de Registros, configuración guardada y favoritos ----------
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const uid = data.session?.user?.id ?? null;
        const r = await resolverEfectivos(def, uid);
        if (cancelado) return;
        const c = leerConsulta(def.id);
        setUserId(uid);
        setEf(r.efectivos);
        setSearch(r.search);
        setViewId(r.viewId);
        setDrill(c?.session?.drill?.etiqueta ?? null);
        if (c?.analisis) setCfg(normalizarConfig(def, c.analisis));
        listoRef.current = true;
      } catch (e: unknown) {
        if (!cancelado) { setError(e instanceof Error ? e.message : 'No se pudo preparar el análisis.'); setCargando(false); }
      }
      try { const g = await listarGuardados(def.id); if (!cancelado) setGuardados(g); } catch { /* sin favoritos */ }
    })();
    return () => { cancelado = true; };
  }, [def]);

  // ---------- la configuración del análisis también se recuerda (en cualquier equipo) ----------
  useEffect(() => { if (listoRef.current) guardarConsulta(def.id, { analisis: cfg as unknown as Record<string, unknown> }); }, [def.id, cfg]);

  // ---------- consulta (con pequeña espera para no disparar en cada clic) ----------
  useEffect(() => {
    if (!ef) return;
    const seq = ++seqRef.current;
    setCargando(true);
    setError(null);
    const t = setTimeout(() => {
      ejecutarAnalisis(def, cfg, ef, search, userId)
        .then(r => { if (seq === seqRef.current) setRes(r); })
        .catch((e: unknown) => { if (seq === seqRef.current) setError(e instanceof Error ? e.message : 'No se pudo calcular el análisis.'); })
        .finally(() => { if (seq === seqRef.current) setCargando(false); });
    }, 250);
    return () => clearTimeout(t);
  }, [def, cfg, ef, search, userId, tick]);

  // ---------- nombres de usuario (solo si se agrupa por un campo de usuario) ----------
  const campoGrupo = cfg.campoGrupo ? fm.get(cfg.campoGrupo) : undefined;
  useEffect(() => {
    if (cfg.modo !== 'campo' || campoGrupo?.dataType !== 'user' || usuarios.size > 0) return;
    fetchUsuariosVisibles()
      .then(us => setUsuarios(new Map(us.map(u => [u.id, u.full_name || u.email]))))
      .catch(() => { /* sin permiso para ver usuarios */ });
  }, [cfg.modo, campoGrupo, usuarios.size]);

  useEffect(() => {
    if (!menuAbierto) return;
    const fuera = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuAbierto(false); };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, [menuAbierto]);

  const cambiar = useCallback((patch: Partial<AnalisisConfig>) => setCfg(prev => normalizarConfig(def, { ...prev, ...patch })), [def]);

  // ---------- datos para la gráfica y la tabla ----------
  const conMedida = cfg.medida.tipo !== 'conteo';
  const comparar = cfg.comparar && !!res?.kpis_anterior;
  const total = res?.kpis.registros ?? 0;

  const puntos: Punto[] = useMemo(() => {
    if (!res) return [];
    const valorDe = (f: { registros: number; medida: number | null }) => Number(conMedida ? (f.medida ?? 0) : f.registros);
    const lista: Punto[] = res.filas.map((f, i) => ({
      key: `${i}-${f.clave ?? 'null'}`,
      etiqueta: cfg.modo === 'fecha' ? etiquetaPeriodoFila(cfg.granularidad, f.clave) : etiquetaValor(campoGrupo, f.clave, usuarios),
      valor: valorDe(f),
      anterior: comparar ? Number(conMedida ? (f.ant_medida ?? 0) : (f.ant_registros ?? 0)) : null,
      pct: total ? (f.registros / total) * 100 : null,
      fila: f,
      esOtros: false,
      clic: cfg.modo === 'fecha' ? f.clave !== null : !(f.clave === null && campoGrupo?.dataType !== 'text'),
    }));
    if (cfg.modo === 'campo' && res.otros && !comparar) {
      lista.push({
        key: 'otros', etiqueta: `Otros (${res.otros.grupos} valores)`, valor: valorDe(res.otros), anterior: null,
        pct: total ? (res.otros.registros / total) * 100 : null, fila: null, esOtros: true, clic: false,
      });
    }
    return lista;
  }, [res, cfg.modo, cfg.granularidad, conMedida, comparar, total, campoGrupo, usuarios]);

  const filtrosCount = (ef?.criteria.length ?? 0) + (ef?.ownerScope === 'mine' ? 1 : 0);
  const contexto = [
    `Vista: ${ef?.viewName ?? 'Todos los registros'}`,
    search ? `búsqueda "${search}"` : null,
    filtrosCount ? `${filtrosCount} filtro${filtrosCount === 1 ? '' : 's'}` : null,
  ].filter(Boolean).join(' · ');

  // ---------- acciones ----------
  const irARegistros = (p: Punto) => {
    if (!p.clic || !p.fila) return;
    const d = criteriosDrill(def, cfg, p.fila, usuarios);
    if (!d) return;
    aplicarDrill(def.id, d.criteria, d.etiqueta, viewId);
    onIrARegistros();
  };

  const quitarFiltroAnalisis = () => {
    quitarDrill(def.id);
    const c = leerConsulta(def.id);
    setEf(c?.efectivos ?? ef);
    setDrill(null);
  };

  const abrirGuardado = (g: AnalisisGuardado) => {
    setMenuAbierto(false);
    const fc = g.config;
    guardarConsulta(def.id, {
      viewId: fc.viewId,
      search: fc.search,
      session: { criteria: fc.efectivos.criteria, logic: fc.efectivos.logic, ownerScope: fc.efectivos.ownerScope, columns: null, sorting: null },
      efectivos: fc.efectivos,
    });
    setEf(fc.efectivos);
    setSearch(fc.search);
    setViewId(fc.viewId);
    setDrill(null);
    setCfg(normalizarConfig(def, fc.analisis));
    onToast(`Se aplicó "${g.nombre}" (también a los filtros de Registros)`, 'success');
  };

  const guardar = async () => {
    if (!ef || !nombre.trim()) return;
    setGuardando(true);
    try {
      const g = await guardarAnalisis(def.id, nombre, { analisis: cfg, viewId, search, efectivos: ef });
      setGuardados(prev => [...prev, g].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')));
      setGuardarAbierto(false);
      setNombre('');
      onToast(`Análisis "${g.nombre}" guardado`, 'success');
    } catch (e: unknown) {
      onToast(e instanceof Error ? e.message : 'No se pudo guardar el análisis.', 'error');
    } finally {
      setGuardando(false);
    }
  };

  const borrarGuardado = async (g: AnalisisGuardado) => {
    try {
      await eliminarGuardado(g.id);
      setGuardados(prev => prev.filter(x => x.id !== g.id));
      onToast(`Se eliminó "${g.nombre}"`, 'success');
    } catch (e: unknown) {
      onToast(e instanceof Error ? e.message : 'No se pudo eliminar.', 'error');
    }
  };

  const exportar = async () => {
    if (!res) return;
    setExportando(true);
    try { await exportarExcel(def, cfg, res, contexto, usuarios); }
    catch (e: unknown) { onToast(e instanceof Error ? e.message : 'No se pudo exportar.', 'error'); }
    finally { setExportando(false); }
  };

  // ---------- render ----------
  const sel = 'h-9 px-2.5 text-sm border border-rule rounded-lg bg-white focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft';
  const etiquetaCtl = 'block text-[10.5px] font-bold tracking-[0.08em] uppercase text-ink-faint mb-1';
  const btn = 'inline-flex items-center gap-1.5 h-9 px-3 text-sm font-semibold rounded-lg border border-rule bg-white text-ink-soft hover:bg-rule-soft disabled:opacity-50';
  const segBtn = (activo: boolean) => `h-9 px-3 text-sm font-semibold transition-colors ${activo ? 'bg-brand text-white' : 'bg-white text-ink-soft hover:bg-rule-soft'}`;
  const valorMedida = cfg.medida.tipo === 'conteo' ? 'conteo' : `${cfg.medida.tipo}:${cfg.medida.campo}`;
  const gran = GRANULARIDADES.find(g => g.id === cfg.granularidad) ?? GRANULARIDADES[0];
  const ultimo = cfg.modo === 'fecha' && res ? [...res.filas].reverse().find(f => f.clave !== null) : undefined;
  const sinComparar = cfg.periodo === 'todo' || (cfg.periodo === 'personalizado' && (!cfg.desde || !cfg.hasta));
  const titulo = cfg.modo === 'fecha'
    ? `${etiquetaMedida(def, cfg)} por ${gran.label.toLowerCase()} · ${fm.get(cfg.campoFecha)?.label ?? cfg.campoFecha}`
    : `${etiquetaMedida(def, cfg)} por ${campoGrupo?.label ?? ''}`;
  const presets = def.analisis?.presets ?? [];
  const alturaCampo = Math.max(160, puntos.length * (comparar ? 44 : 32) + 40);

  return (
    <div className="space-y-4">
      {/* Qué se está analizando */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-faint">
          <span>Analizando</span>
          <span className="px-2 py-0.5 rounded-full bg-rule-soft border border-rule text-ink-soft font-medium">{ef?.viewName ?? 'Todos los registros'}</span>
          {search && <span className="px-2 py-0.5 rounded-full bg-rule-soft border border-rule text-ink-soft">búsqueda «{search}»</span>}
          {filtrosCount > 0 && <span className="px-2 py-0.5 rounded-full bg-rule-soft border border-rule text-ink-soft">{filtrosCount} filtro{filtrosCount === 1 ? '' : 's'}</span>}
          {drill && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-soft border border-brand/20 text-brand">
              Desde Análisis: {drill}
              <button onClick={quitarFiltroAnalisis} className="hover:text-brand-deep" title="Quitar este filtro"><X className="w-3 h-3" /></button>
            </span>
          )}
        </div>
        <button onClick={onIrARegistros} className="text-xs font-semibold text-brand hover:underline">Cambiar filtros en Registros &rarr;</button>
      </div>

      {/* Controles: una sola fila sobre todo lo que filtran */}
      <div className="flex flex-wrap items-end gap-3 p-3 bg-rule-soft/60 border border-rule rounded-card">
        <div>
          <span className={etiquetaCtl}>Agrupar</span>
          <div className="inline-flex rounded-lg border border-rule overflow-hidden">
            <button onClick={() => cambiar({ modo: 'fecha' })} className={segBtn(cfg.modo === 'fecha')}>Por fecha</button>
            <button onClick={() => cambiar({ modo: 'campo' })} className={`${segBtn(cfg.modo === 'campo')} border-l border-rule`}>Por campo</button>
          </div>
        </div>
        <div>
          <span className={etiquetaCtl}>{cfg.modo === 'fecha' ? 'Fecha' : 'Fecha del periodo'}</span>
          <select value={cfg.campoFecha} onChange={e => cambiar({ campoFecha: e.target.value })} className={sel}>
            {camposFecha(def).map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
        </div>
        {cfg.modo === 'fecha' ? (
          <div>
            <span className={etiquetaCtl}>Cada</span>
            <div className="inline-flex rounded-lg border border-rule overflow-hidden">
              {GRANULARIDADES.map((g, i) => (
                <button key={g.id} onClick={() => cambiar({ granularidad: g.id as Granularidad })} className={`${segBtn(cfg.granularidad === g.id)} ${i > 0 ? 'border-l border-rule' : ''}`}>{g.label}</button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div>
              <span className={etiquetaCtl}>Campo</span>
              <select value={cfg.campoGrupo ?? ''} onChange={e => cambiar({ campoGrupo: e.target.value })} className={sel}>
                {camposAgrupables(def).map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
            </div>
            <div>
              <span className={etiquetaCtl}>Mostrar</span>
              <select value={cfg.top} onChange={e => cambiar({ top: Number(e.target.value) })} className={sel}>
                {[10, 15, 25, 50].map(n => <option key={n} value={n}>Top {n}</option>)}
              </select>
            </div>
          </>
        )}
        <div>
          <span className={etiquetaCtl}>Medida</span>
          <select
            value={valorMedida}
            onChange={e => {
              const [tipo, campo] = e.target.value.split(':');
              cambiar({ medida: tipo === 'conteo' ? { tipo: 'conteo', campo: null } : { tipo: tipo as 'suma' | 'promedio', campo } });
            }}
            className={sel}
          >
            <option value="conteo">Número de registros</option>
            {camposNumericos(def).map(f => <option key={`s-${f.key}`} value={`suma:${f.key}`}>Suma de {f.label}</option>)}
            {camposNumericos(def).map(f => <option key={`p-${f.key}`} value={`promedio:${f.key}`}>Promedio de {f.label}</option>)}
          </select>
        </div>
        <div>
          <span className={etiquetaCtl}>Periodo</span>
          <select value={cfg.periodo} onChange={e => cambiar({ periodo: e.target.value as AnalisisConfig['periodo'] })} className={sel}>
            {PERIODOS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
        {cfg.periodo === 'personalizado' && (
          <div className="flex items-end gap-1.5">
            <div>
              <span className={etiquetaCtl}>Desde</span>
              <input type="date" value={cfg.desde ?? ''} onChange={e => cambiar({ desde: e.target.value || null })} className={sel} />
            </div>
            <div>
              <span className={etiquetaCtl}>Hasta</span>
              <input type="date" value={cfg.hasta ?? ''} onChange={e => cambiar({ hasta: e.target.value || null })} className={sel} />
            </div>
          </div>
        )}
        <label className={`inline-flex items-center gap-2 h-9 text-sm ${sinComparar ? 'text-ink-faint' : 'text-ink-soft cursor-pointer'}`} title={sinComparar ? 'Elige un periodo para comparar' : etiquetaComparacion(cfg)}>
          <input type="checkbox" checked={cfg.comparar && !sinComparar} disabled={sinComparar} onChange={e => cambiar({ comparar: e.target.checked })} className="w-4 h-4 accent-[#0176D3]" />
          Comparar con periodo anterior
        </label>

        <div className="ml-auto flex items-end gap-2">
          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenuAbierto(o => !o)} className={btn}><LayoutList className="w-4 h-4" /> Reportes <ChevronDown className="w-3.5 h-3.5" /></button>
            {menuAbierto && (
              <div className="absolute right-0 top-full mt-1 w-72 bg-white border border-rule rounded-card shadow-md z-30 py-1 max-h-96 overflow-auto">
                {presets.length > 0 && <p className="px-4 pt-2 pb-1 text-[10.5px] font-bold tracking-[0.12em] uppercase text-ink-faint">Sugeridos</p>}
                {presets.map(p => (
                  <button key={p.nombre} onClick={() => { setMenuAbierto(false); setCfg(prev => aplicarPreset(def, prev, p)); }} className="w-full text-left px-4 py-2 text-sm text-ink hover:bg-rule-soft">{p.nombre}</button>
                ))}
                <div className="my-1 border-t border-rule-soft" />
                <p className="px-4 pt-2 pb-1 text-[10.5px] font-bold tracking-[0.12em] uppercase text-ink-faint">Mis análisis</p>
                {guardados.length === 0 && <p className="px-4 py-2 text-xs text-ink-faint">Aún no tienes análisis guardados.</p>}
                {guardados.map(g => (
                  <div key={g.id} className="flex items-center hover:bg-rule-soft">
                    <button onClick={() => abrirGuardado(g)} className="flex-1 min-w-0 text-left px-4 py-2 text-sm text-ink truncate">{g.nombre}</button>
                    <button onClick={() => borrarGuardado(g)} className="px-3 py-2 text-ink-faint hover:text-bad" title="Eliminar análisis guardado"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => { setNombre(''); setGuardarAbierto(true); }} disabled={!ef} className={btn} title="Guardar este análisis con nombre"><Star className="w-4 h-4" /> Guardar</button>
          <button onClick={exportar} disabled={!res || exportando} className={btn} title="Descargar el resumen en Excel">
            {exportando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Excel
          </button>
          <button onClick={() => setTick(x => x + 1)} className={`${btn} w-9 justify-center px-0`} title="Actualizar"><RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} /></button>
        </div>
      </div>

      {error && <div className="px-3 py-2 text-sm text-bad bg-bad-soft border border-bad/20 rounded-lg">{error}</div>}

      {!res && !error ? (
        <div className="py-16 text-center text-sm text-ink-faint">Calculando análisis…</div>
      ) : res && (
        <div className={`space-y-4 transition-opacity ${cargando ? 'opacity-60' : ''}`}>
          {/* Indicadores */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Indicador
              etiqueta="Registros"
              valor={entero(res.kpis.registros)}
              delta={comparar ? variacion(res.kpis.registros, res.kpis_anterior?.registros) : null}
              deltaTexto={etiquetaComparacion(cfg)}
              nota={comparar ? `Antes: ${entero(res.kpis_anterior?.registros)}` : etiquetaPeriodo(cfg)}
            />
            {conMedida ? (
              <Indicador
                etiqueta={etiquetaMedida(def, cfg)}
                valor={formatoMedida(def, cfg, res.kpis.medida)}
                delta={comparar ? variacion(res.kpis.medida, res.kpis_anterior?.medida) : null}
                deltaTexto={etiquetaComparacion(cfg)}
                nota={comparar ? `Antes: ${formatoMedida(def, cfg, res.kpis_anterior?.medida)}` : undefined}
              />
            ) : cfg.modo === 'fecha' ? (
              <Indicador
                etiqueta="Último periodo"
                valor={ultimo ? entero(ultimo.registros) : '—'}
                nota={ultimo ? `${etiquetaPeriodoFila(cfg.granularidad, ultimo.clave)} · ${total ? ((ultimo.registros / total) * 100).toFixed(1) : '0'}% del total` : undefined}
              />
            ) : (
              <Indicador etiqueta="Valores distintos" valor={entero(res.total_grupos)} nota={res.total_grupos > cfg.top ? `Se muestran los ${cfg.top} principales` : undefined} />
            )}
            <Indicador
              etiqueta={cfg.modo === 'campo' ? 'Días con registros' : `${gran.plural} con registros`}
              valor={entero(res.kpis.periodos)}
              nota={cfg.modo === 'campo' ? 'Fechas distintas en el periodo' : `Agrupando por ${gran.label.toLowerCase()}`}
            />
            <Indicador
              etiqueta="Rango de fechas"
              valor={rangoFechasCorto(res.kpis.fecha_min, res.kpis.fecha_max)}
              chico
              nota={res.kpis.fecha_max ? `Más reciente: ${fechaHora(res.kpis.fecha_max)}` : undefined}
            />
          </div>

          {/* Gráfica */}
          <div className="bg-white border border-rule rounded-card p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
              <h3 className="text-sm font-semibold text-ink">{titulo}</h3>
              <div className="flex items-center gap-4 text-xs text-ink-faint">
                {comparar && (
                  <>
                    <span className="inline-flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: AZUL }} /> Periodo actual</span>
                    <span className="inline-flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: GRIS }} /> Periodo anterior</span>
                  </>
                )}
                {total > 0 && <span>Clic en una barra para ver esos registros</span>}
              </div>
            </div>
            {total === 0 ? (
              <div className="py-16 text-center text-sm text-ink-faint">Sin registros para estos filtros y periodo.</div>
            ) : cfg.modo === 'fecha' ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={puntos} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
                  <CartesianGrid vertical={false} stroke={REJILLA} />
                  <XAxis dataKey="etiqueta" tick={{ fontSize: 11, fill: TEXTO_EJE }} tickLine={false} axisLine={{ stroke: EJE }} interval="preserveStartEnd" minTickGap={18} />
                  <YAxis tick={{ fontSize: 11, fill: TEXTO_EJE }} tickLine={false} axisLine={false} width={56} tickFormatter={compacto} allowDecimals={conMedida} />
                  <Tooltip cursor={{ fill: 'rgba(1,118,211,0.06)' }} content={<Globo def={def} cfg={cfg} comparar={false} />} />
                  <Bar dataKey="valor" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} onClick={(d: { payload?: Punto }) => d.payload && irARegistros(d.payload)}>
                    {puntos.map(p => <Cell key={p.key} fill={p.clic ? AZUL : GRIS} cursor={p.clic ? 'pointer' : 'default'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height={alturaCampo}>
                <BarChart data={puntos} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 4 }} barGap={2}>
                  <CartesianGrid horizontal={false} stroke={REJILLA} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: TEXTO_EJE }} tickLine={false} axisLine={false} tickFormatter={compacto} allowDecimals={conMedida} />
                  <YAxis type="category" dataKey="etiqueta" width={190} tick={{ fontSize: 12, fill: '#444444' }} tickLine={false} axisLine={{ stroke: EJE }} tickFormatter={(s: string) => recortar(s, 30)} />
                  <Tooltip cursor={{ fill: 'rgba(1,118,211,0.06)' }} content={<Globo def={def} cfg={cfg} comparar={comparar} />} />
                  <Bar dataKey="valor" radius={[0, 4, 4, 0]} maxBarSize={20} isAnimationActive={false} onClick={(d: { payload?: Punto }) => d.payload && irARegistros(d.payload)}>
                    {puntos.map(p => <Cell key={p.key} fill={p.esOtros || !p.clic ? GRIS : AZUL} cursor={p.clic ? 'pointer' : 'default'} />)}
                  </Bar>
                  {comparar && <Bar dataKey="anterior" fill={GRIS} radius={[0, 4, 4, 0]} maxBarSize={20} isAnimationActive={false} />}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Tabla (misma información que la gráfica) */}
          <div className="border border-rule rounded-card overflow-auto max-h-[420px]">
            <table className="w-full text-sm">
              <thead className="bg-rule-soft border-b border-rule sticky top-0">
                <tr className="text-xs font-semibold text-ink-soft uppercase tracking-wider">
                  <th className="text-left px-4 py-2.5">{cfg.modo === 'fecha' ? 'Periodo' : (campoGrupo?.label ?? 'Valor')}</th>
                  <th className="text-right px-4 py-2.5">Registros</th>
                  <th className="text-right px-4 py-2.5">% del total</th>
                  {conMedida && <th className="text-right px-4 py-2.5">{etiquetaMedida(def, cfg)}</th>}
                  {comparar && <th className="text-right px-4 py-2.5">Periodo anterior</th>}
                  {comparar && <th className="text-right px-4 py-2.5">Variación</th>}
                </tr>
              </thead>
              <tbody>
                {(cfg.modo === 'fecha' ? [...puntos].reverse() : puntos).map(p => {
                  const v = comparar && p.fila ? variacion(conMedida ? p.fila.medida : p.fila.registros, conMedida ? p.fila.ant_medida : p.fila.ant_registros) : null;
                  return (
                    <tr key={p.key} onClick={() => irARegistros(p)} className={`border-b border-rule-soft last:border-0 ${p.clic ? 'cursor-pointer hover:bg-brand-soft/40' : ''}`}>
                      <td className="px-4 py-2 text-ink">{p.etiqueta}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-ink">{entero(p.fila ? p.fila.registros : res.otros?.registros)}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-ink-soft">{p.pct === null ? '—' : `${p.pct.toFixed(1)}%`}</td>
                      {conMedida && <td className="px-4 py-2 text-right tabular-nums text-ink">{formatoMedida(def, cfg, p.fila ? p.fila.medida : res.otros?.medida)}</td>}
                      {comparar && <td className="px-4 py-2 text-right tabular-nums text-ink-soft">{conMedida ? formatoMedida(def, cfg, p.fila?.ant_medida) : entero(p.fila?.ant_registros)}</td>}
                      {comparar && <td className="px-4 py-2 text-right tabular-nums text-ink-soft">{v === null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(1)}%`}</td>}
                    </tr>
                  );
                })}
                {comparar && res.otros && (
                  <tr className="border-b border-rule-soft text-ink-soft">
                    <td className="px-4 py-2">Otros ({res.otros.grupos} valores)</td>
                    <td className="px-4 py-2 text-right tabular-nums">{entero(res.otros.registros)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{total ? `${((res.otros.registros / total) * 100).toFixed(1)}%` : '—'}</td>
                    {conMedida && <td className="px-4 py-2 text-right tabular-nums">{formatoMedida(def, cfg, res.otros.medida)}</td>}
                    <td className="px-4 py-2" /><td className="px-4 py-2" />
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-rule-soft/60 border-t border-rule">
                <tr className="font-semibold text-ink">
                  <td className="px-4 py-2">Total</td>
                  <td className="px-4 py-2 text-right tabular-nums">{entero(total)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">100%</td>
                  {conMedida && <td className="px-4 py-2 text-right tabular-nums">{formatoMedida(def, cfg, res.kpis.medida)}</td>}
                  {comparar && <td className="px-4 py-2 text-right tabular-nums">{conMedida ? formatoMedida(def, cfg, res.kpis_anterior?.medida) : entero(res.kpis_anterior?.registros)}</td>}
                  {comparar && <td className="px-4 py-2" />}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {guardarAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setGuardarAbierto(false)} />
          <div className="relative bg-white rounded-hero shadow-lg border border-rule-soft w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-bold text-ink mb-1">Guardar análisis</h3>
            <p className="text-sm text-ink-soft mb-4">Se guardan la agrupación, la medida, el periodo y los filtros actuales de Registros. Solo tú lo ves.</p>
            <input
              autoFocus
              value={nombre}
              maxLength={80}
              onChange={e => setNombre(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') guardar(); }}
              placeholder="Ej. Precios modificados por día"
              className="w-full h-10 px-3 text-sm border border-rule rounded-lg focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft mb-5"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setGuardarAbierto(false)} disabled={guardando} className="inline-flex items-center h-10 px-4 bg-white text-ink-soft font-semibold text-sm rounded-lg border border-rule hover:bg-rule-soft">Cancelar</button>
              <button onClick={guardar} disabled={guardando || !nombre.trim()} className="inline-flex items-center gap-2 h-10 px-4 bg-brand text-white font-semibold text-sm rounded-lg hover:bg-brand-deep disabled:opacity-60">
                {guardando && <Loader2 className="w-4 h-4 animate-spin" />} Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Indicador({ etiqueta, valor, nota, delta, deltaTexto, chico }: { etiqueta: string; valor: string; nota?: string; delta?: number | null; deltaTexto?: string; chico?: boolean }) {
  return (
    <div className="bg-white border border-rule rounded-card px-4 py-3 min-w-0">
      <div className="text-xs text-ink-faint truncate">{etiqueta}</div>
      <div className={`mt-1 font-semibold text-ink truncate ${chico ? 'text-base' : 'text-2xl'}`} title={valor}>{valor}</div>
      {delta !== null && delta !== undefined && (
        <div className="mt-0.5 inline-flex items-center gap-1 text-xs text-ink-soft">
          {delta >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
          <span className="font-semibold">{delta > 0 ? '+' : ''}{delta.toLocaleString('es-MX', { maximumFractionDigits: 1 })}%</span>
          <span className="text-ink-faint">{deltaTexto}</span>
        </div>
      )}
      {nota && <div className="mt-0.5 text-xs text-ink-faint truncate" title={nota}>{nota}</div>}
    </div>
  );
}

interface GloboProps {
  def: AdminObjectDef;
  cfg: AnalisisConfig;
  comparar: boolean;
  active?: boolean;
  payload?: { payload: Punto }[];
}

function Globo({ def, cfg, comparar, active, payload }: GloboProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const fmt = (v: number | null) => (cfg.medida.tipo === 'conteo' ? entero(v) : formatoMedida(def, cfg, v));
  return (
    <div className="bg-white border border-rule rounded-lg shadow-md px-3 py-2 text-xs max-w-[260px]">
      <div className="text-sm font-semibold text-ink">{fmt(p.valor)}</div>
      <div className="text-ink-soft">{p.etiqueta}</div>
      {p.pct !== null && <div className="text-ink-faint">{p.pct.toFixed(1)}% de los registros</div>}
      {comparar && p.anterior !== null && (
        <div className="mt-1 flex items-center gap-1.5 text-ink-soft">
          <span className="inline-block w-3 h-0.5" style={{ background: GRIS }} /> Periodo anterior: {fmt(p.anterior)}
        </div>
      )}
      {p.clic && <div className="mt-1 text-brand">Clic para ver estos registros</div>}
    </div>
  );
}
