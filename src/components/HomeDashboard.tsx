import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import AppLayout from './layout/AppLayout';
import {
  FileText,
  Package,
  Plus,
  Upload,
  DollarSign,
  CheckCircle,
  TrendingUp,
  ArrowUpRight,
  Eye,
  ScanText,
} from 'lucide-react';

interface HomeDashboardProps {
  onNewQuote: () => void;
  onNewQuoteDocling?: () => void;
  onOpenAdmin?: () => void;
}

/* ─── Sub-components (internal only) ─── */

function KpiCard({ icon: Icon, iconColor, iconBg, title, value, sub, delta, deltaPositive }: {
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  title: string;
  value: string;
  sub: string;
  delta: string;
  deltaPositive: boolean;
}) {
  return (
    <div className="bg-white rounded-card p-5 shadow-sm border border-rule-soft animate-rise-in">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBg}`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
          deltaPositive ? 'text-good bg-good-soft' : 'text-bad bg-bad-soft'
        }`}>
          {deltaPositive ? '\u25B2' : '\u25BC'} {delta}
        </span>
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

function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    Generada: 'bg-good-soft text-good',
    Enviada: 'bg-brand-soft text-brand',
    'En revisión': 'bg-warn-soft text-warn',
    Borrador: 'bg-rule-soft text-ink-faint',
  };
  return (
    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${map[status] || 'bg-rule-soft text-ink-faint'}`}>
      {status}
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

/* ─── Mock data ─── */

const MOCK_QUOTES = [
  { client: 'Industrial Monterrey SA', id: 'QAI-2847', total: '$124,850', products: 32, recognized: 29, confidence: 94, status: 'Generada' },
  { client: 'Constructora Del Norte', id: 'QAI-2846', total: '$87,320', products: 18, recognized: 16, confidence: 88, status: 'Enviada' },
  { client: 'Talleres Solís', id: 'QAI-2845', total: '$45,200', products: 12, recognized: 10, confidence: 82, status: 'En revisión' },
  { client: 'Maquiladora Saltillo', id: 'QAI-2844', total: '$203,500', products: 48, recognized: 44, confidence: 91, status: 'Generada' },
  { client: 'Refaccionaria Apodaca', id: 'QAI-2843', total: '$31,750', products: 8, recognized: 7, confidence: 76, status: 'Borrador' },
  { client: 'Servicios Eléctricos GMX', id: 'QAI-2842', total: '$156,400', products: 26, recognized: 24, confidence: 92, status: 'Generada' },
  { client: 'Aceros Industriales SA', id: 'QAI-2841', total: '$92,100', products: 22, recognized: 19, confidence: 85, status: 'Enviada' },
];

const FILTER_TABS = [
  { label: 'Todas', count: 47 },
  { label: 'Generadas', count: 42 },
  { label: 'En revisión', count: 3 },
  { label: 'Borrador', count: 2 },
];

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

function HomeDashboard({ onNewQuote, onNewQuoteDocling, onOpenAdmin }: HomeDashboardProps) {
  const auth = useAuth();
  const [activeFilter, setActiveFilter] = useState(0);

  const handleNavigate = (section: string) => {
    if (section === 'cotizar') onNewQuote();
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
                <button
                  onClick={onNewQuote}
                  className="inline-flex items-center gap-2 px-5 py-2.5 border border-white/30 text-white font-medium text-sm rounded-lg hover:bg-white/10 transition-all"
                >
                  <Upload className="w-4 h-4" />
                  Subir archivo
                </button>
                {onNewQuoteDocling && (
                  <button
                    onClick={onNewQuoteDocling}
                    className="inline-flex items-center gap-2 px-5 py-2.5 border border-white/30 text-white font-medium text-sm rounded-lg hover:bg-white/10 transition-all"
                  >
                    <ScanText className="w-4 h-4" />
                    Subir vía Docling (Railway)
                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-bold tracking-wide leading-none">
                      BETA
                    </span>
                  </button>
                )}
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
              value="47"
              sub="vs mes anterior"
              delta="+12"
              deltaPositive
            />
            <KpiCard
              icon={DollarSign}
              iconColor="text-good"
              iconBg="bg-good-soft"
              title="Valor total"
              value="$2.84M MXN"
              sub="ticket prom. $60,425"
              delta="8.3%"
              deltaPositive
            />
            <KpiCard
              icon={Package}
              iconColor="text-[#7F56D9]"
              iconBg="bg-[#F4EBFF]"
              title="Productos / cotización"
              value="18.4"
              sub="rango 4–62"
              delta="2.1"
              deltaPositive
            />
            <KpiCard
              icon={CheckCircle}
              iconColor="text-[#B86C00]"
              iconBg="bg-warn-soft"
              title="Tasa de generación"
              value="89%"
              sub="42 de 47"
              delta="4 pts"
              deltaPositive
            />
          </section>

          {/* Quality panels */}
          <section className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr_1fr] gap-4">
            {/* Confidence distribution */}
            <div className="bg-white rounded-card p-5 shadow-sm border border-rule-soft animate-rise-in stagger-1">
              <h3 className="text-sm font-semibold text-ink mb-4">Distribución por confianza</h3>
              <div className="space-y-3">
                <ConfidenceBar label="Alta" pct={73} count={631} color="bg-good" />
                <ConfidenceBar label="Media" pct={19} count={164} color="bg-warn" />
                <ConfidenceBar label="Baja" pct={8} count={70} color="bg-bad" />
              </div>
            </div>

            {/* OCR precision */}
            <div className="bg-white rounded-card p-5 shadow-sm border border-rule-soft animate-rise-in stagger-2">
              <h3 className="text-sm font-semibold text-ink mb-3">Precisión de lectura</h3>
              <OcrDial value={89} />
              <div className="mt-3 space-y-1.5 text-xs text-ink-faint">
                <div className="flex justify-between">
                  <span>1er intento</span>
                  <span className="font-medium text-ink">82%</span>
                </div>
                <div className="flex justify-between">
                  <span>Con reintento</span>
                  <span className="font-medium text-good">+7%</span>
                </div>
                <div className="flex justify-between">
                  <span>Manual</span>
                  <span className="font-medium text-ink">11%</span>
                </div>
              </div>
            </div>

            {/* Average confidence trend */}
            <div className="bg-white rounded-card p-5 shadow-sm border border-rule-soft animate-rise-in stagger-3">
              <h3 className="text-sm font-semibold text-ink mb-1">Confianza promedio</h3>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-3xl font-bold text-ink">91.2%</span>
                <span className="text-xs font-semibold text-good flex items-center gap-0.5">
                  <TrendingUp className="w-3 h-3" /> 3.4 pts
                </span>
              </div>
              <p className="text-[10px] text-ink-faint mb-3">Últimas 10 cotizaciones</p>
              <MiniTrendBars values={[62, 71, 58, 78, 82, 75, 88, 84, 91, 94]} />
            </div>
          </section>

          {/* Quotes table */}
          <section className="bg-white rounded-card shadow-sm border border-rule-soft animate-rise-in stagger-4">
            <div className="p-5 pb-0">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-ink">Tus propuestas recientes</h3>
                <button className="text-xs text-brand font-medium flex items-center gap-1 hover:underline">
                  Ver todas <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
              {/* Segmented filter */}
              <div className="flex gap-1 border-b border-rule">
                {FILTER_TABS.map((tab, i) => (
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
                    <th className="text-right py-3 px-4 font-medium">Total</th>
                    <th className="text-center py-3 px-4 font-medium">Productos</th>
                    <th className="text-center py-3 px-4 font-medium">Reconocidos</th>
                    <th className="text-center py-3 px-4 font-medium">Confianza</th>
                    <th className="text-center py-3 px-4 font-medium">Estatus</th>
                    <th className="text-center py-3 px-4 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_QUOTES.map((q) => (
                    <tr
                      key={q.id}
                      className="border-b border-rule-soft last:border-0 hover:bg-bg/50 transition-colors"
                    >
                      <td className="py-3 px-5">
                        <p className="font-medium text-ink text-sm">{q.client}</p>
                        <p className="text-[11px] text-ink-faint font-mono">{q.id}</p>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-ink">{q.total}</td>
                      <td className="py-3 px-4 text-center text-ink-soft">{q.products}</td>
                      <td className="py-3 px-4">
                        <RecognitionBar recognized={q.recognized} total={q.products} />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <ConfidenceChip value={q.confidence} />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <StatusChip status={q.status} />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button className="w-7 h-7 rounded-full hover:bg-rule-soft flex items-center justify-center text-ink-faint transition-colors">
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
      </div>
    </AppLayout>
  );
}


export default HomeDashboard