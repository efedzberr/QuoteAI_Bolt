import { supabase } from './supabase';

export interface JobLine {
  id: string;
  job_id: string;
  line_index: number;
  codigo_original: string | null;
  descripcion_original: string | null;
  unidad_original: string | null;
  cantidad: number | null;
  producto_codigo: string | null;
  producto_descripcion: string | null;
  unidad_medida: string | null;
  precio_unitario: number | null;
  confianza: number | null;
  origen: 'auto' | 'manual' | 'producto_nuevo' | 'sin_match';
  estado: 'pendiente' | 'aprobada' | 'ignorada';
  requiere_revision: boolean;
  total_linea: number | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export type JobLineInsert = Omit<JobLine, 'id' | 'created_at' | 'updated_at'>;
export type JobLineUpsertFields = Partial<Omit<JobLine, 'id' | 'job_id' | 'line_index' | 'created_at' | 'updated_at'>>;

const BATCH_SIZE = 200;

export async function createJobLines(jobId: string, lines: JobLineInsert[]): Promise<void> {
  for (let i = 0; i < lines.length; i += BATCH_SIZE) {
    const batch = lines.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('job_lines')
      .insert(batch);
    if (error) {
      console.error('[jobLines] createJobLines batch error:', error);
    }
  }
}

export async function upsertJobLine(
  jobId: string,
  lineIndex: number,
  fields: JobLineUpsertFields
): Promise<void> {
  const { error } = await supabase
    .from('job_lines')
    .upsert(
      {
        job_id: jobId,
        line_index: lineIndex,
        ...fields,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'job_id,line_index' }
    );
  if (error) console.error('[jobLines] upsertJobLine error:', error);
}

export async function bulkUpsertJobLines(jobId: string, lines: Array<{ line_index: number } & JobLineUpsertFields>): Promise<void> {
  const rows = lines.map((l) => ({
    job_id: jobId,
    ...l,
    updated_at: new Date().toISOString(),
  }));

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('job_lines')
      .upsert(batch, { onConflict: 'job_id,line_index' });
    if (error) {
      console.error('[jobLines] bulkUpsertJobLines batch error:', error);
    }
  }
}

export async function deleteJobLine(jobId: string, lineIndex: number): Promise<void> {
  const { error } = await supabase
    .from('job_lines')
    .delete()
    .eq('job_id', jobId)
    .eq('line_index', lineIndex);
  if (error) console.error('[jobLines] deleteJobLine error:', error);
}

export async function fetchJobLines(jobId: string): Promise<JobLine[]> {
  const { data, error } = await supabase
    .from('job_lines')
    .select('*')
    .eq('job_id', jobId)
    .order('line_index', { ascending: true });

  if (error) {
    console.error('[jobLines] fetchJobLines error:', error);
    return [];
  }
  return (data as JobLine[]) || [];
}

export async function getMaxLineIndex(jobId: string): Promise<number> {
  const { data, error } = await supabase
    .from('job_lines')
    .select('line_index')
    .eq('job_id', jobId)
    .order('line_index', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) return -1;
  return data[0].line_index;
}

export interface JobLineStat {
  productos: number;
  reconocidos: number;
  total: number;
  confianza: number;
}

export interface GlobalLineStats {
  totalLineas: number;
  totalValor: number;
  reconocidos: number;
  confianzaAlta: number;
  confianzaMedia: number;
  confianzaBaja: number;
  confianzaPromedio: number;
}

export interface JobLineStatsResult {
  perJob: Record<string, JobLineStat>;
  global: GlobalLineStats;
}

async function fetchSingleJobStats(jobId: string): Promise<JobLineStat> {
  const [countRes, reconocidosRes, detailRes] = await Promise.all([
    supabase
      .from('job_lines')
      .select('*', { count: 'exact', head: true })
      .eq('job_id', jobId),
    supabase
      .from('job_lines')
      .select('*', { count: 'exact', head: true })
      .eq('job_id', jobId)
      .not('producto_codigo', 'is', null),
    supabase
      .from('job_lines')
      .select('total_linea, confianza')
      .eq('job_id', jobId),
  ]);

  const productos = countRes.count ?? 0;
  const reconocidos = reconocidosRes.count ?? 0;

  let total = 0;
  let confianzaSum = 0;
  let confianzaCount = 0;
  if (detailRes.data) {
    for (const row of detailRes.data) {
      total += row.total_linea || 0;
      if (row.confianza !== null) {
        confianzaSum += row.confianza;
        confianzaCount++;
      }
    }
  }

  return {
    productos,
    reconocidos,
    total,
    confianza: confianzaCount > 0 ? Math.round(confianzaSum / confianzaCount) : 0,
  };
}

export async function fetchJobLineStats(jobIds: string[]): Promise<JobLineStatsResult> {
  const empty: JobLineStatsResult = {
    perJob: {},
    global: { totalLineas: 0, totalValor: 0, reconocidos: 0, confianzaAlta: 0, confianzaMedia: 0, confianzaBaja: 0, confianzaPromedio: 0 },
  };
  if (jobIds.length === 0) return empty;

  const results = await Promise.all(jobIds.map((id) => fetchSingleJobStats(id).then((stat) => ({ id, stat }))));

  const grouped: Record<string, JobLineStat> = {};
  let totalLineas = 0;
  let totalValor = 0;
  let reconocidos = 0;
  let confianzaAlta = 0;
  let confianzaMedia = 0;
  let confianzaBaja = 0;
  let confianzaWeightedSum = 0;

  for (const { id, stat } of results) {
    grouped[id] = stat;
    totalLineas += stat.productos;
    totalValor += stat.total;
    reconocidos += stat.reconocidos;
    confianzaWeightedSum += stat.confianza * stat.productos;

    if (stat.confianza >= 90) confianzaAlta += stat.productos;
    else if (stat.confianza >= 70) confianzaMedia += stat.productos;
    else if (stat.productos > 0) confianzaBaja += stat.productos;
  }

  return {
    perJob: grouped,
    global: {
      totalLineas,
      totalValor,
      reconocidos,
      confianzaAlta,
      confianzaMedia,
      confianzaBaja,
      confianzaPromedio: totalLineas > 0 ? Math.round((confianzaWeightedSum / totalLineas) * 10) / 10 : 0,
    },
  };
}
