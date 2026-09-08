/*
# Vista como usuario ("Iniciar sesión como", estilo Salesforce)

Permite a un administrador real "ver como" otro usuario, evaluando permisos,
visibilidad y propiedad desde la perspectiva de ese usuario sin generar una
sesión nueva ni pedir credenciales.

1. New Tables
   - `admin_impersonations`
     - `admin_id` (uuid, PK, FK → user_profiles) — el admin que inicia la vista
     - `target_user_id` (uuid, FK → user_profiles) — el usuario objetivo
     - `started_at` (timestamptz)
     - `expires_at` (timestamptz, default now + 2 h)
     - CHECK: admin_id ≠ target_user_id
   - `admin_impersonation_log`
     - `id` (uuid, PK)
     - `admin_id`, `admin_email`, `target_user_id`, `target_email`
     - `started_at`, `ended_at`, `ended_reason`

2. New Functions
   - `is_admin_real()` — true si auth.uid() es admin activo (ignora vista)
   - `effective_uid()` — target_user_id si hay vista activa, si no auth.uid()
   - `vista_actual()` — datos JSON del usuario objetivo de la vista activa
   - `admin_impersonations_log_trigger()` — bitácora automática

3. Modified Functions (redefinidas con effective_uid())
   - `tiene_permiso_sistema(flag)`
   - `tiene_permiso_objeto(obj, accion)`
   - `usuarios_visibles()`
   - `puede_ver_usuario(uid)`
   - `mis_permisos()` — ahora incluye campo `vista_como`
   - `is_admin()` — sigue identidad efectiva

4. Modified Tables
   - `jobs.owner_id` DEFAULT cambia a effective_uid()
   - Nueva política `jobs_insert` con effective_uid()
   - Nueva política `user_profiles_select_effective`

5. Security
   - RLS en ambas tablas nuevas; REVOKE anon.
   - Políticas: solo admin real con AAL2 puede operar su propia fila de vista.
   - Log de auditoría solo visible para admin real con AAL2.
   - Todas las funciones SECURITY DEFINER con search_path = public.
*/

-- ============================================================
-- 1. Tablas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admin_impersonations (
  admin_id uuid PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '2 hours'),
  CONSTRAINT admin_impersonations_not_self CHECK (admin_id <> target_user_id)
);
ALTER TABLE public.admin_impersonations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_impersonations FROM anon;

CREATE TABLE IF NOT EXISTS public.admin_impersonation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  admin_email text,
  target_user_id uuid NOT NULL,
  target_email text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  ended_reason text
);
ALTER TABLE public.admin_impersonation_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_impersonation_log FROM anon;

-- ============================================================
-- 2. Identidad real vs efectiva
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin_real()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT up.is_admin AND up.is_active FROM public.user_profiles up WHERE up.id = auth.uid()), false);
$$;
REVOKE ALL ON FUNCTION public.is_admin_real() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_real() TO authenticated;

CREATE OR REPLACE FUNCTION public.effective_uid()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT i.target_user_id
    FROM public.admin_impersonations i
    JOIN public.user_profiles a ON a.id = i.admin_id
    JOIN public.user_profiles t ON t.id = i.target_user_id
    WHERE i.admin_id = auth.uid()
      AND a.is_admin AND a.is_active
      AND t.is_active
      AND i.expires_at > now()
  ), auth.uid());
$$;
REVOKE ALL ON FUNCTION public.effective_uid() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.effective_uid() TO authenticated;

-- Políticas: solo el administrador real maneja su propia fila de vista
DROP POLICY IF EXISTS admin_impersonations_own ON public.admin_impersonations;
CREATE POLICY admin_impersonations_own ON public.admin_impersonations FOR ALL TO authenticated
  USING (public.is_aal2() AND admin_id = auth.uid() AND public.is_admin_real())
  WITH CHECK (public.is_aal2() AND admin_id = auth.uid() AND public.is_admin_real());

DROP POLICY IF EXISTS admin_impersonation_log_select ON public.admin_impersonation_log;
CREATE POLICY admin_impersonation_log_select ON public.admin_impersonation_log FOR SELECT TO authenticated
  USING (public.is_aal2() AND public.is_admin_real());

-- Bitácora automática
CREATE OR REPLACE FUNCTION public.admin_impersonations_log_trigger()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.admin_impersonation_log (admin_id, admin_email, target_user_id, target_email)
    SELECT NEW.admin_id, a.email, NEW.target_user_id, t.email
    FROM public.user_profiles a, public.user_profiles t
    WHERE a.id = NEW.admin_id AND t.id = NEW.target_user_id;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    UPDATE public.admin_impersonation_log
    SET ended_at = now(), ended_reason = 'salir'
    WHERE admin_id = OLD.admin_id AND target_user_id = OLD.target_user_id AND ended_at IS NULL;
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_impersonations_log ON public.admin_impersonations;
CREATE TRIGGER trg_admin_impersonations_log
  AFTER INSERT OR DELETE ON public.admin_impersonations
  FOR EACH ROW EXECUTE FUNCTION public.admin_impersonations_log_trigger();

-- Estado actual de la vista (para el banner del frontend)
CREATE OR REPLACE FUNCTION public.vista_actual()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'target_user_id', t.id, 'full_name', t.full_name, 'email', t.email,
    'started_at', i.started_at, 'expires_at', i.expires_at
  )
  FROM public.admin_impersonations i
  JOIN public.user_profiles a ON a.id = i.admin_id
  JOIN public.user_profiles t ON t.id = i.target_user_id
  WHERE i.admin_id = auth.uid() AND a.is_admin AND a.is_active AND i.expires_at > now();
$$;
REVOKE ALL ON FUNCTION public.vista_actual() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vista_actual() TO authenticated;

-- ============================================================
-- 3. Funciones de QA_P1 con identidad efectiva
-- ============================================================
CREATE OR REPLACE FUNCTION public.tiene_permiso_sistema(flag text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT CASE flag
      WHEN 'ver_todos_datos'           THEN p.ver_todos_datos OR p.modificar_todos_datos
      WHEN 'modificar_todos_datos'     THEN p.modificar_todos_datos
      WHEN 'administrar_usuarios'      THEN p.administrar_usuarios
      WHEN 'administrar_configuracion' THEN p.administrar_configuracion
      WHEN 'ver_inventario'            THEN p.ver_inventario
      ELSE false END
    FROM public.user_profiles up
    JOIN public.perfiles p ON p.id = up.perfil_id
    WHERE up.id = public.effective_uid() AND up.is_active
  ), false);
$$;

CREATE OR REPLACE FUNCTION public.tiene_permiso_objeto(obj text, accion text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT CASE accion
      WHEN 'leer'     THEN COALESCE(o.can_read, false)   OR p.ver_todos_datos OR p.modificar_todos_datos
      WHEN 'crear'    THEN COALESCE(o.can_create, false)
      WHEN 'editar'   THEN COALESCE(o.can_edit, false)   OR p.modificar_todos_datos
      WHEN 'eliminar' THEN COALESCE(o.can_delete, false) OR p.modificar_todos_datos
      ELSE false END
    FROM public.user_profiles up
    JOIN public.perfiles p ON p.id = up.perfil_id
    LEFT JOIN public.perfil_permisos_objeto o ON o.perfil_id = p.id AND o.object_name = obj
    WHERE up.id = public.effective_uid() AND up.is_active
  ), false);
$$;

CREATE OR REPLACE FUNCTION public.usuarios_visibles()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE me AS (
    SELECT up.id, up.rol_id FROM public.user_profiles up WHERE up.id = public.effective_uid() AND up.is_active
  ),
  sub AS (
    SELECT r.id FROM public.roles r WHERE r.parent_id = (SELECT rol_id FROM me) AND (SELECT rol_id FROM me) IS NOT NULL
    UNION ALL
    SELECT r.id FROM public.roles r JOIN sub ON r.parent_id = sub.id
  )
  SELECT id FROM me
  UNION
  SELECT up.id FROM public.user_profiles up JOIN sub ON up.rol_id = sub.id;
$$;

CREATE OR REPLACE FUNCTION public.puede_ver_usuario(uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT uid IS NOT NULL AND (
    uid = public.effective_uid()
    OR public.tiene_permiso_sistema('ver_todos_datos')
    OR uid IN (SELECT public.usuarios_visibles())
  );
$$;

CREATE OR REPLACE FUNCTION public.mis_permisos()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'is_active', COALESCE(up.is_active, false),
    'is_admin', COALESCE(up.is_admin AND up.is_active, false),
    'full_name', up.full_name,
    'perfil_id', p.id,
    'perfil', p.name,
    'rol_id', r.id,
    'rol', r.name,
    'ver_todos_datos', COALESCE(p.ver_todos_datos OR p.modificar_todos_datos, false),
    'modificar_todos_datos', COALESCE(p.modificar_todos_datos, false),
    'administrar_usuarios', COALESCE(p.administrar_usuarios, false),
    'administrar_configuracion', COALESCE(p.administrar_configuracion, false),
    'ver_inventario', COALESCE(p.ver_inventario, false),
    'objetos', COALESCE((
      SELECT jsonb_object_agg(o.object_name, jsonb_build_object(
        'leer', o.can_read OR p.ver_todos_datos OR p.modificar_todos_datos,
        'crear', o.can_create,
        'editar', o.can_edit OR p.modificar_todos_datos,
        'eliminar', o.can_delete OR p.modificar_todos_datos
      ))
      FROM public.perfil_permisos_objeto o WHERE o.perfil_id = p.id
    ), '{}'::jsonb),
    'vista_como', public.vista_actual()
  )
  FROM public.user_profiles up
  LEFT JOIN public.perfiles p ON p.id = up.perfil_id
  LEFT JOIN public.roles r ON r.id = up.rol_id
  WHERE up.id = public.effective_uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT up.is_admin AND up.is_active FROM public.user_profiles up WHERE up.id = public.effective_uid()), false);
$$;

-- ============================================================
-- 4. Propuestas creadas en vista quedan a nombre del usuario
-- ============================================================
ALTER TABLE public.jobs ALTER COLUMN owner_id SET DEFAULT public.effective_uid();

DROP POLICY IF EXISTS jobs_insert ON public.jobs;
CREATE POLICY jobs_insert ON public.jobs FOR INSERT TO authenticated
  WITH CHECK (public.is_aal2() AND public.tiene_permiso_objeto('cotizaciones', 'crear') AND owner_id = public.effective_uid());

DROP POLICY IF EXISTS user_profiles_select_effective ON public.user_profiles;
CREATE POLICY user_profiles_select_effective ON public.user_profiles FOR SELECT TO authenticated
  USING (id = public.effective_uid());