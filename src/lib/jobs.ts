import { supabase } from './supabase';

export type JobStatus =
  | 'nueva_solicitud' | 'extraccion' | 'extraccion_completada' | 'revision_datos'
  | 'matching' | 'matching_completado' | 'validacion' | 'generacion'
  | 'completado' | 'completada' | 'pdf_generado' | 'error'
  | 'procesando' | 'en_revision' | 'enviado_validacion';

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
  sf_opportunity_id?: string | null;
  sf_quote_id?: string | null;
  sf_sent_at?: string | null;
}

export async function createJob(referencia: string, cliente: string): Promise<Job | null> {
  const { data, error } = await supabase
    .from('jobs')
    .insert({ referencia, cliente, status: 'nueva_solicitud' })
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

export async function updateJobProgreso(referencia: string, progreso: number): Promise<void> {
  const { error } = await supabase
    .from('jobs')
    .update({ progreso, updated_at: new Date().toISOString() })
    .eq('referencia', referencia);
  if (error) console.error('[jobs] updateJobProgreso error:', error);
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

export async function markJobSentToSalesforce(
  referencia: string,
  sfOpportunityId: string,
  sfQuoteId?: string
): Promise<void> {
  const { error } = await supabase
    .from('jobs')
    .update({
      sf_opportunity_id: sfOpportunityId,
      sf_quote_id: sfQuoteId || null,
      sf_sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('referencia', referencia);
  if (error) console.error('[jobs] markJobSentToSalesforce error:', error);
}
