/*
# Perfiles de usuario + bandera de administrador

- user_profiles: una fila por usuario de auth.users (nombre, teléfono, ID Salesforce,
  is_admin, is_active). Se crea automáticamente al crear el usuario en auth (trigger).
- is_admin(): true si el usuario actual es administrador activo. SECURITY DEFINER para
  poder usarse dentro de políticas RLS sin recursión.
- RLS: cada usuario ve su propia fila; los administradores (con 2FA verificado, aal2)
  ven todas. Nadie escribe desde el cliente: todas las altas/cambios pasan por la
  Edge Function admin-users con service role.
- Backfill de los usuarios existentes y bootstrap del primer administrador.
*/

-- ============================================================
-- 1. Tabla
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  phone text,
  salesforce_id text,
  is_admin boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_profiles_email_idx ON public.user_profiles (lower(email));

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_profiles FROM anon;

-- ============================================================
-- 2. updated_at automático
-- ============================================================
CREATE OR REPLACE FUNCTION public.user_profiles_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.user_profiles_set_updated_at();

-- ============================================================
-- 3. Crear perfil al crear usuario en auth.users
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ============================================================
-- 4. is_admin()
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.is_admin AND p.is_active FROM public.user_profiles p WHERE p.id = auth.uid()),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ============================================================
-- 5. Políticas RLS (solo lectura desde el cliente)
-- ============================================================
DROP POLICY IF EXISTS "user_profiles_select_own" ON public.user_profiles;
CREATE POLICY "user_profiles_select_own" ON public.user_profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "user_profiles_select_admin" ON public.user_profiles;
CREATE POLICY "user_profiles_select_admin" ON public.user_profiles
  FOR SELECT TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2' AND public.is_admin());

-- ============================================================
-- 6. Backfill de usuarios existentes + primer administrador
-- ============================================================
INSERT INTO public.user_profiles (id, email, full_name, phone)
SELECT
  u.id,
  COALESCE(u.email, ''),
  COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'),
  u.raw_user_meta_data->>'phone'
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

UPDATE public.user_profiles
SET is_admin = true
WHERE lower(email) = 'ernesto.fernandez@wolkegroup.com';