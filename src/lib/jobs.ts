import { supabase } from './supabase';

export type JobStatus = 'procesando' | 'en_revision' | 'enviado_validacion' | 'completado' | 'error';

export interface Job {
  id: string;
  referencia: string;
  cliente: string | null;
  status: JobStatus;
  total_lineas: number;
  progreso: number;
  payload: any;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export async function createJob(referencia: string, cliente: string): Promise<Job | null> {
  const { data, error } = await supabase
    .from('jobs')
    .insert({ referencia, cliente, status: 'procesando' })
    .select()
    .single();

  if (error) {
    console.error('[jobs] createJob error:', error);
    return null;
  }
  return data as Job;
}

export async function updateJobPayload(
  referencia: string,
  payload: any,
  totalLineas: number
): Promise<void> {
  const { error } = await supabase
    .from('jobs')
    .update({
      payload,
      total_lineas: totalLineas,
      status: 'en_revision',
      updated_at: new Date().toISOString(),
    })
    .eq('referencia', referencia);

  if (error) console.error('[jobs] updateJobPayload error:', error);
}

export async function updateJobStatus(
  referencia: string,
  status: JobStatus,
  extra?: { error?: string; payload?: any }
): Promise<void> {
  const update: Record<string, any> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (extra?.error) update.error = extra.error;
  if (extra?.payload !== undefined) update.payload = extra.payload;

  const { error } = await supabase
    .from('jobs')
    .update(update)
    .eq('referencia', referencia);

  if (error) console.error('[jobs] updateJobStatus error:', error);
}

export async function updateJobPayloadDebounced(
  referencia: string,
  payload: any,
  totalLineas: number
): Promise<void> {
  const { error } = await supabase
    .from('jobs')
    .update({
      payload,
      total_lineas: totalLineas,
      updated_at: new Date().toISOString(),
    })
    .eq('referencia', referencia);

  if (error) console.error('[jobs] updateJobPayloadDebounced error:', error);
}

export async function fetchRecentJobs(limit = 10): Promise<Job[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[jobs] fetchRecentJobs error:', error);
    return [];
  }
  return (data as Job[]) || [];
}

export async function getJobByReferencia(referencia: string): Promise<Job | null> {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('referencia', referencia)
    .single();

  if (error) return null;
  return data as Job;
}
