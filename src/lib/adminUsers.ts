import { supabase } from './supabase';

export interface AdminUserRow {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  salesforce_id: string | null;
  is_admin: boolean;
  is_active: boolean;
  ver_inventario: boolean;
  mfa_enrolled: boolean;
  last_sign_in_at: string | null;
  created_at: string;
}

export interface LinkResult {
  email: string;
  mode: 'invite' | 'recovery';
  link: string | null;
  sent_user: boolean;
  sent_admin: boolean;
  error: string | null;
}

export async function callAdminUsers<T = Record<string, unknown>>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Tu sesion expiro. Vuelve a iniciar sesion.');
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ action, app_url: window.location.origin, ...payload }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error || `Error ${res.status}`);
  return json as T;
}
