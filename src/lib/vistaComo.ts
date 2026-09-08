import { supabase } from './supabase';

export interface VistaComo {
  target_user_id: string;
  full_name: string | null;
  email: string;
  started_at: string;
  expires_at: string;
}

export async function fetchVistaActual(): Promise<VistaComo | null> {
  const { data, error } = await supabase.rpc('vista_actual');
  if (error) { console.error('[vistaComo] vista_actual:', error); return null; }
  return (data as VistaComo | null) ?? null;
}

export async function iniciarVistaComo(targetUserId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sesión no válida.');
  // Cerrar cualquier vista previa y abrir la nueva
  await supabase.from('admin_impersonations').delete().eq('admin_id', user.id);
  const { error } = await supabase.from('admin_impersonations').insert({ admin_id: user.id, target_user_id: targetUserId });
  if (error) throw new Error(error.message);
}

export async function salirVistaComo(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from('admin_impersonations').delete().eq('admin_id', user.id);
  if (error) throw new Error(error.message);
}
