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

export async function fetchJobLineStats(jobIds: string[]): Promise<Record<string, JobLineStat>> {
  if (jobIds.length === 0) return {};

  const { data, error } = await supabase
    .from('job_lines')
    .select('job_id, producto_codigo, confianza, total_linea')
    .in('job_id', jobIds);

  if (error || !data) {
    console.error('[jobLines] fetchJobLineStats error:', error);
    return {};
  }

  const grouped: Record<string, JobLineStat> = {};
  for (const row of data) {
    if (!grouped[row.job_id]) {
      grouped[row.job_id] = { productos: 0, reconocidos: 0, total: 0, confianza: 0 };
    }
    const stat = grouped[row.job_id];
    stat.productos++;
    if (row.producto_codigo) stat.reconocidos++;
    stat.total += row.total_linea || 0;
    stat.confianza += row.confianza || 0;
  }

  for (const id of Object.keys(grouped)) {
    const stat = grouped[id];
    stat.confianza = stat.productos > 0 ? Math.round(stat.confianza / stat.productos) : 0;
  }

  return grouped;
}
