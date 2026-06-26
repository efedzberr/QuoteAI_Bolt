import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Capturamos la intencion de invitacion/recuperacion ANTES de crear el cliente.
// createClient (detectSessionInUrl) procesa y LIMPIA el hash de la URL de
// inmediato; si lo leyeramos despues (en un useEffect) ya estaria borrado, y por
// eso la pantalla "Define tu contrasena" no aparecia.
export const isPasswordSetupRedirect =
  /type=(recovery|invite)/.test(window.location.hash) ||
  /type=(recovery|invite)/.test(window.location.search);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
