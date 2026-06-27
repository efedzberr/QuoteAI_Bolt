import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import AppLayout from './layout/AppLayout';
import { fetchRecentJobs, countJobs, countJobsByStatus, type Job, type JobStatus } from '../lib/jobs';
import { fetchJobLineStats, type JobLineStat, type GlobalLineStats } from '../lib/jobLines';
import { getStageInfo, isResumableStage, isProcessingStage, isFinalStage, isValidatedStage } from '../lib/jobStages';
import {
  FileText,
  Package,
  Plus,
  DollarSign,
  CheckCircle,

  Eye,
  RefreshCw,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface HomeDashboardProps {
  onNewQuote: () => void;
  onOpenAdmin?: () => void;
  onOpenCatalog?: () => void;
  onResumeJob?: (job: Job) => void;
  onReexecuteJob?: (job: Job) => void;
  onJobClick?: (job: Job) => void;
}

/* ─── Sub-components (internal only) ─── */

function KpiCard({ icon: Icon, iconColor, iconBg, title, value, sub }: {
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  title: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="bg-white rounded-card p-5 shadow-sm border border-rule-soft animate-rise-in">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBg}`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
      </div>
      <p className="text-xs text-ink-faint font-medium uppercase tracking-wide mb-1">{title}</p>
      <p className="text-2xl font-bold text-ink">{value}</p>
      <p className="text-xs text-ink-faint mt-1">{sub}</p>
    </div>
  );
}

function ConfidenceBar({ label, pct, count, color }: {
  label: string;
  pct: number;
  count: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-ink-faint w-12 shrink-0">{label}</span>
      <div className="flex-1 h-6 bg-rule-soft rounded-full overflow-hidden relative">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-ink">
          {pct}% &middot; {count} prod
        </span>
      </div>
    </div>
  );
}

function OcrDial({ value }: { value: number }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;

  return (
    <div className="relative w-32 h-32 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
        <circle cx="64" cy="64" r={r} fill="none" stroke="#E5E5E5" strokeWidth="10" />
        <circle
          cx="64" cy="64" r={r} fill="none"
          stroke="#0176D3" strokeWidth="10"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-ink">{value}%</span>
        <span className="text-[10px] text-ink-faint">precisión</span>
      </div>
    </div>
  );
}

function MiniTrendBars({ values }: { values: number[] }) {
  const max = Math.max(...values);
  return (
    <div className="flex items-end gap-1 h-16">
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-t bg-brand/70 transition-all duration-500"
          style={{ height: `${(v / max) * 100}%` }}
        />
      ))}
    </div>
  );
}

function JobStatusChip({ status }: { status: string }) {
  const info = getStageInfo(status);
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
      style={{ backgroundColor: info.bgColor, color: info.color }}
    >
      {info.type === 'procesando' && <Loader2 className="w-3 h-3 animate-spin" />}
      {info.label}
    </span>
  );
}

function ConfidenceChip({ value }: { value: number }) {
  const cls = value >= 85
    ? 'bg-good-soft text-good'
    : value >= 60
      ? 'bg-warn-soft text-warn'
      : 'bg-bad-soft text-bad';
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cls}`}>
      {value}%
    </span>
  );
}

function RecognitionBar({ recognized, total }: { recognized: number; total: number }) {
  const pct = total > 0 ? (recognized / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-2 bg-rule-soft rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-brand to-good" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] text-ink-faint">{recognized}/{total}</span>
    </div>
  );
}

/* ─── Helpers ─── */

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function getFormattedDate(): string {
  const now = new Date();
  const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const day = days[now.getDay()];
  const date = now.getDate();
  const month = months[now.getMonth()];
  const hours = now.getHours().toString().padStart(2, '0');
  const mins = now.getMinutes().toString().padStart(2, '0');
  return `${day} ${date} de ${month} \u00B7 ${hours}:${mins}`;
}

/* ─── Main Component ─── */

function HomeDashboard({ onNewQuote, onOpenAdmin, onOpenCatalog, onResumeJob, onReexecuteJob, onJobClick }: HomeDashboardProps) {
  const auth = useAuth();
  const [activeFilter, setActiveFilter] = useState(0);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [jobStats, setJobStats] = useState<Record<string, JobLineStat>>({});
  const [globalStats, setGlobalStats] = useState<GlobalLineStats>({ totalLineas: 0, totalValor: 0, reconocidos: 0, confianzaAlta: 0, confianzaMedia: 0, confianzaBaja: 0, confianzaPromedio: 0 });
  const [totalCotizaciones, setTotalCotizaciones] = useState(0);
  const [totalGeneradas, setTotalGeneradas] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadJobs = async () => {
    const [data, total, generadas] = await Promise.all([
      fetchRecentJobs(20),
      countJobs(),
      countJobsByStatus(['pdf_generado']),
    ]);
    setJobs(data);
    setLoadingJobs(false);
    setTotalCotizaciones(total);
    setTotalGeneradas(generadas);
    const ids = data.map((j) => j.id).filter(Boolean);
    if (ids.length > 0) {
      const result = await fetchJobLineStats(ids);
      setJobStats(result.perJob);
      setGlobalStats(result.global);
    }
  };

  useEffect(() => {
    loadJobs();
    pollRef.current = setInterval(loadJobs, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const isGenerada = (s: JobStatus) => s === 'pdf_generado';
  const isPendiente = (s: JobStatus) =>
    s === 'completado' || s === 'completada' ||
    s === 'validacion' || s === 'matching_completado' || s === 'en_revision' ||
    s === 'revision_datos' || s === 'enviado_validacion';
  const isBorrador = (s: JobStatus) =>
    s === 'nueva_solicitud' || s === 'extraccion' || s === 'extraccion_completada' ||
    s === 'matching' || s === 'procesando' || s === 'generacion';

  const filteredJobs = activeFilter === 0
    ? jobs
    : activeFilter === 1
    ? jobs.filter((j) => isGenerada(j.status))
    : activeFilter === 2
    ? jobs.filter((j) => isPendiente(j.status))
    : jobs.filter((j) => isBorrador(j.status));

  const filterTabs = [
    { label: 'Todas', count: jobs.length },
    { label: 'Generadas', count: jobs.filter((j) => isGenerada(j.status)).length },
    { label: 'Pendientes', count: jobs.filter((j) => isPendiente(j.status)).length },
    { label: 'Borrador', count: jobs.filter((j) => isBorrador(j.status)).length },
  ];

  const formatMXN = (value: number) => {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(value);
  };

  const kpiCotizaciones = totalCotizaciones;
  const kpiValorTotal = globalStats.totalValor;
  const kpiProductosPorCotizacion = jobs.length > 0 ? (globalStats.totalLineas / jobs.length).toFixed(1) : '0';
  const kpiTasaGeneracion = totalCotizaciones > 0 ? Math.round((totalGeneradas / totalCotizaciones) * 100) : 0;

  const confTotal = globalStats.totalLineas;
  const confAltaPct = confTotal > 0 ? Math.round((globalStats.confianzaAlta / confTotal) * 100) : 0;
  const confMediaPct = confTotal > 0 ? Math.round((globalStats.confianzaMedia / confTotal) * 100) : 0;
  const confBajaPct = confTotal > 0 ? Math.round((globalStats.confianzaBaja / confTotal) * 100) : 0;
  const precisionLectura = confTotal > 0 ? Math.round((globalStats.reconocidos / confTotal) * 100) : 0;

  const handleNavigate = (section: string) => {
    if (section === 'cotizar') onNewQuote();
    else if (section === 'catalogo') onOpenCatalog?.();
    else if (section === 'ajustes') onOpenAdmin?.();
  };

  return (
    <AppLayout
      active="home"
      breadcrumbs={[{ label: 'Inicio' }, { label: 'Tablero' }]}
      onNavigate={handleNavigate}
    >
      <div className="space-y-6">
          {/* Hero banner */}
          <section
            className="rounded-hero p-7 text-white relative overflow-hidden animate-rise-in"
            style={{ background: 'linear-gradient(135deg, #0176D3 0%, #032D60 100%)' }}
          >
            <div className="absolute inset-0 opacity-[0.04]" style={{
              backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)',
              backgroundSize: '40px 40px, 60px 60px',
            }} />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-sm text-white/80">
                  {getGreeting()} &middot; {getFormattedDate()}
                </span>
              </div>
              <h1 className="text-2xl font-bold mb-1">
                Hola, {auth.displayName}. ¿Qué cotizamos hoy?
              </h1>
              <p className="text-sm text-white/70 max-w-xl mb-5">
                Aquí tienes el resumen de tu actividad reciente, indicadores de calidad de lectura y tus propuestas en curso.
              </p>
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={onNewQuote}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-brand font-semibold text-sm rounded-lg hover:bg-white/90 transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
                >
                  <Plus className="w-4 h-4" />
                  Nueva cotización
                </button>
              </div>
            </div>
          </section>

          {/* KPI Grid */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              icon={FileText}
              iconColor="text-brand"
              iconBg="bg-brand-soft"
              title="Cotizaciones"
              value={String(kpiCotizaciones)}
              sub="cotizaciones en total"
            />
            <KpiCard
              icon={DollarSign}
              iconColor="text-good"
              iconBg="bg-good-soft"
              title="Valor total"
              value={`${formatMXN(kpiValorTotal)} MXN`}
              sub={kpiCotizaciones > 0 ? `ticket prom. ${formatMXN(kpiValorTotal / kpiCotizaciones)}` : ''}
            />
            <KpiCard
              icon={Package}
              iconColor="text-[#7F56D9]"
              iconBg="bg-[#F4EBFF]"
              title="Productos / cotización"
              value={kpiProductosPorCotizacion}
              sub={`${globalStats.totalLineas} líneas totales`}
            />
            <KpiCard
              icon={CheckCircle}
              iconColor="text-[#B86C00]"
              iconBg="bg-warn-soft"
              title="Tasa de generación"
              value={`${kpiTasaGeneracion}%`}
              sub={`${totalGeneradas} de ${totalCotizaciones}`}
            />
          </section>

          {/* Quality panels */}
          <section className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr_1fr] gap-4">
            {/* Confidence distribution */}
            <div className="bg-white rounded-card p-5 shadow-sm border border-rule-soft animate-rise-in stagger-1">
              <h3 className="text-sm font-semibold text-ink mb-4">Distribución por confianza</h3>
              <div className="space-y-3">
                <ConfidenceBar label="Alta (≥90%)" pct={confAltaPct} count={globalStats.confianzaAlta} color="bg-good" />
                <ConfidenceBar label="Media (70-89%)" pct={confMediaPct} count={globalStats.confianzaMedia} color="bg-warn" />
                <ConfidenceBar label="Baja (<70%)" pct={confBajaPct} count={globalStats.confianzaBaja} color="bg-bad" />
              </div>
            </div>

            {/* OCR precision */}
            <div className="bg-white rounded-card p-5 shadow-sm border border-rule-soft animate-rise-in stagger-2">
              <h3 className="text-sm font-semibold text-ink mb-3">Precisión de lectura</h3>
              <OcrDial value={precisionLectura} />
              <div className="mt-3 space-y-1.5 text-xs text-ink-faint">
                <div className="flex justify-between">
                  <span>Líneas con match</span>
                  <span className="font-medium text-ink">{globalStats.reconocidos}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total líneas</span>
                  <span className="font-medium text-ink">{globalStats.totalLineas}</span>
                </div>
              </div>
            </div>

            {/* Average confidence */}
            <div className="bg-white rounded-card p-5 shadow-sm border border-rule-soft animate-rise-in stagger-3">
              <h3 className="text-sm font-semibold text-ink mb-1">Confianza promedio</h3>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-3xl font-bold text-ink">{globalStats.confianzaPromedio}%</span>
              </div>
              <p className="text-[10px] text-ink-faint mb-3">Sobre {globalStats.totalLineas} líneas</p>
              <MiniTrendBars values={jobs.slice(0, 10).map((j) => jobStats[j.id]?.confianza ?? 0)} />
            </div>
          </section>

          {/* Quotes table */}
          <section className="bg-white rounded-card shadow-sm border border-rule-soft animate-rise-in stagger-4">
            <div className="p-5 pb-0">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-ink">Tus propuestas recientes</h3>
              </div>
              {/* Segmented filter */}
              <div className="flex gap-1 border-b border-rule">
                {filterTabs.map((tab, i) => (
                  <button
                    key={tab.label}
                    onClick={() => setActiveFilter(i)}
                    className={`px-3 py-2 text-xs font-medium rounded-t-md transition-colors ${
                      i === activeFilter
                        ? 'text-brand border-b-2 border-brand bg-brand-soft/40'
                        : 'text-ink-faint hover:text-ink'
                    }`}
                  >
                    {tab.label} <span className="text-ink-faint">({tab.count})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-ink-faint uppercase tracking-wider border-b border-rule-soft">
                    <th className="text-left py-3 px-5 font-medium">Cliente / Propuesta</th>
                    <th className="text-center py-3 px-3 font-medium">Líneas</th>
                    <th className="text-center py-3 px-3 font-medium">Productos</th>
                    <th className="text-center py-3 px-3 font-medium">Reconocidos</th>
                    <th className="text-center py-3 px-3 font-medium">Confianza</th>
                    <th className="text-right py-3 px-3 font-medium">Total</th>
                    <th className="text-center py-3 px-3 font-medium">Estatus</th>
                    <th className="text-left py-3 px-3 font-medium">Fecha</th>
                    <th className="text-center py-3 px-3 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingJobs ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-sm text-ink-faint">
                        Cargando trabajos...
                      </td>
                    </tr>
                  ) : filteredJobs.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-sm text-ink-faint">
                        No hay propuestas en esta categoría.
                      </td>
                    </tr>
                  ) : (
                    filteredJobs.map((job) => {
                      const stat = jobStats[job.id];
                      const productos = stat?.productos ?? 0;
                      const reconocidos = stat?.reconocidos ?? 0;
                      const total = stat?.total ?? 0;
                      const confianza = stat?.confianza ?? 0;
                      const progressPct = job.total_lineas > 0
                        ? Math.min(100, Math.round((job.progreso / job.total_lineas) * 100))
                        : 0;

                      return (
                        <tr
                          key={job.id}
                          onClick={() => onJobClick?.(job)}
                          className="border-b border-rule-soft last:border-0 hover:bg-brand-soft/30 transition-colors cursor-pointer"
                        >
                          <td className="py-3 px-5">
                            <p className="font-medium text-ink text-sm">{job.cliente || 'Sin cliente'}</p>
                            <p className="text-[11px] text-ink-faint font-mono">{job.referencia}</p>
                          </td>
                          <td className="py-3 px-3 text-center text-ink-soft">
                            {job.total_lineas || 0}
                          </td>
                          <td className="py-3 px-3 text-center text-ink-soft">{productos}</td>
                          <td className="py-3 px-3">
                            <RecognitionBar recognized={reconocidos} total={productos} />
                          </td>
                          <td className="py-3 px-3 text-center">
                            {confianza > 0 ? <ConfidenceChip value={confianza} /> : <span className="text-[11px] text-ink-faint">-</span>}
                          </td>
                          <td className="py-3 px-3 text-right font-semibold text-ink">
                            {total > 0 ? formatMXN(total) : '-'}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex flex-col items-center gap-1">
                              <JobStatusChip status={job.status} />
                              {isProcessingStage(job.status) && job.total_lineas > 0 && (
                                <div className="w-full max-w-[100px] flex items-center gap-1.5">
                                  <div className="flex-1 h-1.5 bg-rule-soft rounded-full overflow-hidden">
                                    <div
                                      className="h-full rounded-full bg-brand transition-all duration-500"
                                      style={{ width: `${progressPct}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] text-ink-faint font-medium">{progressPct}%</span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-xs text-ink-faint whitespace-nowrap">
                            {new Date(job.created_at).toLocaleDateString('es-MX', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {(isResumableStage(job.status) || isValidatedStage(job.status)) && onResumeJob && (
                              <button
                                onClick={(e) => { e.stopPropagation(); onResumeJob(job); }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold text-brand bg-brand-soft rounded-md hover:bg-brand/10 transition-colors"
                              >
                                <Eye className="w-3 h-3" />
                                Revisar / Validar
                              </button>
                            )}
                            {isFinalStage(job.status) && onResumeJob && (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={(e) => { e.stopPropagation(); onResumeJob(job); }}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold text-good bg-good-soft rounded-md hover:bg-good/10 transition-colors"
                                >
                                  <Eye className="w-3 h-3" />
                                  Ver PDF
                                </button>
                                {onReexecuteJob && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); onReexecuteJob(job); }}
                                    className="inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-semibold text-brand bg-brand-soft rounded-md hover:bg-brand/10 transition-colors"
                                    title="Reejecutar"
                                  >
                                    <RefreshCw className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            )}
                            {isProcessingStage(job.status) && (
                              <span className="inline-flex items-center gap-1 text-[11px] text-ink-faint" title="En proceso...">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                {job.progreso}/{job.total_lineas}
                              </span>
                            )}
                            {job.status === 'error' && job.error && (
                              <span className="inline-flex items-center gap-1 text-[11px] text-bad" title={job.error}>
                                <AlertCircle className="w-3 h-3" />
                                {job.error.substring(0, 30)}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
      </div>
    </AppLayout>
  );
}


export default HomeDashboard