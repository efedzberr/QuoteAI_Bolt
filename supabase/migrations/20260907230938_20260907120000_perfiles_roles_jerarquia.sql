/*
# Perfiles y Roles (modelo Salesforce)

## Summary
Introduces a Salesforce-style Profiles + Roles authorization model.

## New Tables
- `roles` — hierarchical role tree (parent_id). Determines data visibility: a user sees their own records plus those of users whose role hangs below theirs.
- `perfiles` — system-level permission flags (ver_todos_datos, modificar_todos_datos, administrar_usuarios, administrar_configuracion, ver_inventario). Determines what a user CAN DO.
- `perfil_permisos_objeto` — per-object CRUD permissions (cotizaciones, productos_nuevos) linked to a perfil.

## Modified Tables
- `user_profiles` — gains `perfil_id` and `rol_id` columns. `is_admin` is now derived from the linked perfil's `administrar_usuarios` flag via trigger.
- `jobs` — gains `owner_id` column (quote owner, defaults to auth.uid()). Historical jobs without owner assigned to ernesto.fernandez@wolkegroup.com.

## New Functions
- `is_aal2()` — checks if current session has AAL2 (2FA verified).
- `roles_prevent_cycle()` — trigger to prevent circular role hierarchies.
- `perfiles_protect_system()` — trigger to prevent deletion/modification of system profiles.
- `user_profiles_sync_is_admin()` — trigger that derives is_admin from perfil.
- `perfiles_propagate_is_admin()` — propagates administrar_usuarios changes to user_profiles.
- `tiene_permiso_sistema(flag)` — checks system-level permission for current user.
- `tiene_permiso_objeto(obj, accion)` — checks object-level CRUD permission.
- `usuarios_visibles()` — returns set of user IDs visible to current user via role hierarchy.
- `puede_ver_usuario(uid)` — checks if current user can see a specific user.
- `puede_ver_registro(owner)` — checks if current user can see a record by its owner.
- `mis_permisos()` — returns JSONB summary of effective permissions for frontend.
- `job_visible(jid)` — SECURITY DEFINER helper for job_lines RLS.

## Security
- RLS enabled on roles, perfiles, perfil_permisos_objeto.
- All authenticated users with 2FA can SELECT roles/perfiles/perfil_permisos_objeto.
- Only admins with 2FA can write to roles/perfiles/perfil_permisos_objeto.
- user_profiles SELECT policy rewritten to use puede_ver_usuario (hierarchy-aware).
- jobs and job_lines policies fully rewritten: visibility by hierarchy + object permissions + AAL2.
- System profile (Administrador) is protected from deletion and permission removal.

## Seed Data
- "Administrador" profile (system, all permissions, non-deletable).
- "Estándar" profile (default for new users, editable).
- Existing is_admin=true users assigned Administrador profile; others get Estándar.
- Historical jobs without owner assigned to ernesto.fernandez@wolkegroup.com.

## Important Notes
1. is_admin flag is preserved but now computed from perfil — existing is_admin() function and Edge Function continue working unchanged.
2. handle_new_auth_user() updated to assign Estándar profile by default.
3. All SECURITY DEFINER functions have explicit search_path = public.
4. Railway service and Edge Functions use service_role and bypass RLS.
*/

-- ============================================================
-- 0. Helpers
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_aal2()
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT COALESCE((SELECT auth.jwt()->>'aal') = 'aal2', false);
$$;
GRANT EXECUTE ON FUNCTION public.is_aal2() TO authenticated;

-- ============================================================
-- 1. roles (jerarquía)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  parent_id uuid REFERENCES public.roles(id) ON DELETE RESTRICT,
  description text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT roles_name_len CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  CONSTRAINT roles_no_self_parent CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE UNIQUE INDEX IF NOT EXISTS roles_unique_sibling_name
  ON public.roles (COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(btrim(name)));
CREATE INDEX IF NOT EXISTS roles_parent_idx ON public.roles (parent_id);

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.roles FROM anon;

DROP TRIGGER IF EXISTS trg_roles_updated_at ON public.roles;
CREATE TRIGGER trg_roles_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.user_profiles_set_updated_at();

-- Evitar ciclos al mover un rol
CREATE OR REPLACE FUNCTION public.roles_prevent_cycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    WITH RECURSIVE up AS (
      SELECT r.id, r.parent_id FROM public.roles r WHERE r.id = NEW.parent_id
      UNION ALL
      SELECT r.id, r.parent_id FROM public.roles r JOIN up ON r.id = up.parent_id
    )
    SELECT 1 FROM up WHERE up.id = NEW.id
  ) THEN
    RAISE EXCEPTION 'No se puede mover un rol debajo de uno de sus propios descendientes';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_roles_prevent_cycle ON public.roles;
CREATE TRIGGER trg_roles_prevent_cycle
  BEFORE INSERT OR UPDATE OF parent_id ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.roles_prevent_cycle();

-- ============================================================
-- 2. perfiles + permisos por objeto
-- ============================================================
CREATE TABLE IF NOT EXISTS public.perfiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  ver_todos_datos boolean NOT NULL DEFAULT false,
  modificar_todos_datos boolean NOT NULL DEFAULT false,
  administrar_usuarios boolean NOT NULL DEFAULT false,
  administrar_configuracion boolean NOT NULL DEFAULT false,
  ver_inventario boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT perfiles_name_len CHECK (char_length(btrim(name)) BETWEEN 1 AND 80)
);

CREATE UNIQUE INDEX IF NOT EXISTS perfiles_unique_name ON public.perfiles (lower(btrim(name)));

ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.perfiles FROM anon;

DROP TRIGGER IF EXISTS trg_perfiles_updated_at ON public.perfiles;
CREATE TRIGGER trg_perfiles_updated_at
  BEFORE UPDATE ON public.perfiles
  FOR EACH ROW EXECUTE FUNCTION public.user_profiles_set_updated_at();

CREATE TABLE IF NOT EXISTS public.perfil_permisos_objeto (
  perfil_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  object_name text NOT NULL CHECK (object_name IN ('cotizaciones', 'productos_nuevos')),
  can_read boolean NOT NULL DEFAULT false,
  can_create boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  PRIMARY KEY (perfil_id, object_name)
);

ALTER TABLE public.perfil_permisos_objeto ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.perfil_permisos_objeto FROM anon;

-- El perfil de sistema (Administrador) no se borra ni se le quitan permisos
CREATE OR REPLACE FUNCTION public.perfiles_protect_system()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_system THEN
      RAISE EXCEPTION 'El perfil % es de sistema y no se puede eliminar', OLD.name;
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.is_system THEN
    NEW.is_system := true;
    NEW.ver_todos_datos := true;
    NEW.modificar_todos_datos := true;
    NEW.administrar_usuarios := true;
    NEW.administrar_configuracion := true;
    NEW.ver_inventario := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_perfiles_protect_system ON public.perfiles;
CREATE TRIGGER trg_perfiles_protect_system
  BEFORE UPDATE OR DELETE ON public.perfiles
  FOR EACH ROW EXECUTE FUNCTION public.perfiles_protect_system();

CREATE OR REPLACE FUNCTION public.perfil_permisos_objeto_protect_system()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  sys boolean;
BEGIN
  SELECT p.is_system INTO sys FROM public.perfiles p WHERE p.id = COALESCE(NEW.perfil_id, OLD.perfil_id);
  IF sys THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Los permisos del perfil de sistema no se pueden modificar';
    END IF;
    NEW.can_read := true; NEW.can_create := true; NEW.can_edit := true; NEW.can_delete := true;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ppo_protect_system ON public.perfil_permisos_objeto;
CREATE TRIGGER trg_ppo_protect_system
  BEFORE INSERT OR UPDATE OR DELETE ON public.perfil_permisos_objeto
  FOR EACH ROW EXECUTE FUNCTION public.perfil_permisos_objeto_protect_system();

-- ============================================================
-- 3. user_profiles: perfil_id, rol_id, is_admin derivado del perfil
-- ============================================================
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS perfil_id uuid REFERENCES public.perfiles(id) ON DELETE RESTRICT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS rol_id uuid REFERENCES public.roles(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS user_profiles_perfil_idx ON public.user_profiles (perfil_id);
CREATE INDEX IF NOT EXISTS user_profiles_rol_idx ON public.user_profiles (rol_id);

-- ============================================================
-- 4. Semilla mínima: Administrador (sistema) y Estándar
-- ============================================================
INSERT INTO public.perfiles (name, description, is_system, ver_todos_datos, modificar_todos_datos, administrar_usuarios, administrar_configuracion, ver_inventario)
SELECT 'Administrador', 'Perfil de sistema. Todos los permisos; ignora la jerarquía de roles.', true, true, true, true, true, true
WHERE NOT EXISTS (SELECT 1 FROM public.perfiles WHERE is_system);

INSERT INTO public.perfiles (name, description)
SELECT 'Estándar', 'Perfil inicial para usuarios existentes. Edítalo o reemplázalo desde Ajustes > Perfiles.'
WHERE NOT EXISTS (SELECT 1 FROM public.perfiles WHERE lower(btrim(name)) = 'estándar');

INSERT INTO public.perfil_permisos_objeto (perfil_id, object_name, can_read, can_create, can_edit, can_delete)
SELECT p.id, o.object_name, true, true, true, true
FROM public.perfiles p CROSS JOIN (VALUES ('cotizaciones'), ('productos_nuevos')) AS o(object_name)
WHERE p.is_system
ON CONFLICT (perfil_id, object_name) DO NOTHING;

INSERT INTO public.perfil_permisos_objeto (perfil_id, object_name, can_read, can_create, can_edit, can_delete)
SELECT p.id, o.object_name, true, true, true, (o.object_name = 'cotizaciones')
FROM public.perfiles p CROSS JOIN (VALUES ('cotizaciones'), ('productos_nuevos')) AS o(object_name)
WHERE lower(btrim(p.name)) = 'estándar'
ON CONFLICT (perfil_id, object_name) DO NOTHING;

-- Asignar perfil a usuarios existentes (antes de activar el trigger que deriva is_admin)
UPDATE public.user_profiles up
SET perfil_id = (SELECT id FROM public.perfiles WHERE is_system LIMIT 1)
WHERE up.perfil_id IS NULL AND up.is_admin = true;

UPDATE public.user_profiles up
SET perfil_id = (SELECT id FROM public.perfiles WHERE lower(btrim(name)) = 'estándar' LIMIT 1)
WHERE up.perfil_id IS NULL;

-- is_admin se deriva del perfil desde ahora
CREATE OR REPLACE FUNCTION public.user_profiles_sync_is_admin()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.perfil_id IS NULL THEN
    NEW.is_admin := false;
  ELSE
    SELECT COALESCE(p.administrar_usuarios, false) INTO NEW.is_admin
    FROM public.perfiles p WHERE p.id = NEW.perfil_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_profiles_sync_is_admin ON public.user_profiles;
CREATE TRIGGER trg_user_profiles_sync_is_admin
  BEFORE INSERT OR UPDATE OF perfil_id ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.user_profiles_sync_is_admin();

-- Si cambia administrar_usuarios en un perfil, propagar a sus usuarios
CREATE OR REPLACE FUNCTION public.perfiles_propagate_is_admin()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.administrar_usuarios IS DISTINCT FROM OLD.administrar_usuarios THEN
    UPDATE public.user_profiles SET is_admin = NEW.administrar_usuarios WHERE perfil_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_perfiles_propagate_is_admin ON public.perfiles;
CREATE TRIGGER trg_perfiles_propagate_is_admin
  AFTER UPDATE OF administrar_usuarios ON public.perfiles
  FOR EACH ROW EXECUTE FUNCTION public.perfiles_propagate_is_admin();

-- El trigger de creación en auth.users asigna perfil Estándar por default (el admin lo cambia al crear/editar)
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, phone, perfil_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'phone',
    (SELECT id FROM public.perfiles WHERE lower(btrim(name)) = 'estándar' LIMIT 1)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ============================================================
-- 5. Funciones de permisos y visibilidad
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
    WHERE up.id = auth.uid() AND up.is_active
  ), false);
$$;
REVOKE ALL ON FUNCTION public.tiene_permiso_sistema(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tiene_permiso_sistema(text) TO authenticated;

-- accion: 'leer' | 'crear' | 'editar' | 'eliminar'
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
    WHERE up.id = auth.uid() AND up.is_active
  ), false);
$$;
REVOKE ALL ON FUNCTION public.tiene_permiso_objeto(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tiene_permiso_objeto(text, text) TO authenticated;

-- Yo + todos los usuarios cuyo rol cuelga debajo del mío
CREATE OR REPLACE FUNCTION public.usuarios_visibles()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE me AS (
    SELECT up.id, up.rol_id FROM public.user_profiles up WHERE up.id = auth.uid() AND up.is_active
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
REVOKE ALL ON FUNCTION public.usuarios_visibles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.usuarios_visibles() TO authenticated;

CREATE OR REPLACE FUNCTION public.puede_ver_usuario(uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT uid IS NOT NULL AND (
    uid = auth.uid()
    OR public.tiene_permiso_sistema('ver_todos_datos')
    OR uid IN (SELECT public.usuarios_visibles())
  );
$$;
REVOKE ALL ON FUNCTION public.puede_ver_usuario(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.puede_ver_usuario(uuid) TO authenticated;

-- Registro sin dueño: solo lo ve quien tiene ver_todos_datos
CREATE OR REPLACE FUNCTION public.puede_ver_registro(owner uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN owner IS NULL THEN public.tiene_permiso_sistema('ver_todos_datos')
    ELSE public.puede_ver_usuario(owner)
  END;
$$;
REVOKE ALL ON FUNCTION public.puede_ver_registro(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.puede_ver_registro(uuid) TO authenticated;

-- Resumen de permisos efectivos para el frontend (usePermissions)
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
    ), '{}'::jsonb)
  )
  FROM public.user_profiles up
  LEFT JOIN public.perfiles p ON p.id = up.perfil_id
  LEFT JOIN public.roles r ON r.id = up.rol_id
  WHERE up.id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.mis_permisos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mis_permisos() TO authenticated;

-- ============================================================
-- 6. RLS de roles / perfiles / perfil_permisos_objeto
--    Lectura: cualquier usuario autenticado con 2FA (necesario para mostrar nombres).
--    Escritura: solo administradores con 2FA.
-- ============================================================
DROP POLICY IF EXISTS roles_select ON public.roles;
CREATE POLICY roles_select ON public.roles FOR SELECT TO authenticated
  USING (public.is_aal2());
DROP POLICY IF EXISTS roles_write ON public.roles;
CREATE POLICY roles_write ON public.roles FOR ALL TO authenticated
  USING (public.is_aal2() AND public.is_admin())
  WITH CHECK (public.is_aal2() AND public.is_admin());

DROP POLICY IF EXISTS perfiles_select ON public.perfiles;
CREATE POLICY perfiles_select ON public.perfiles FOR SELECT TO authenticated
  USING (public.is_aal2());
DROP POLICY IF EXISTS perfiles_write ON public.perfiles;
CREATE POLICY perfiles_write ON public.perfiles FOR ALL TO authenticated
  USING (public.is_aal2() AND public.is_admin())
  WITH CHECK (public.is_aal2() AND public.is_admin());

DROP POLICY IF EXISTS ppo_select ON public.perfil_permisos_objeto;
CREATE POLICY ppo_select ON public.perfil_permisos_objeto FOR SELECT TO authenticated
  USING (public.is_aal2());
DROP POLICY IF EXISTS ppo_write ON public.perfil_permisos_objeto;
CREATE POLICY ppo_write ON public.perfil_permisos_objeto FOR ALL TO authenticated
  USING (public.is_aal2() AND public.is_admin())
  WITH CHECK (public.is_aal2() AND public.is_admin());

-- user_profiles: además de la propia fila y del admin, se ven los usuarios de mi jerarquía
DROP POLICY IF EXISTS user_profiles_select_visible ON public.user_profiles;
CREATE POLICY user_profiles_select_visible ON public.user_profiles
  FOR SELECT TO authenticated
  USING (public.is_aal2() AND public.puede_ver_usuario(id));

-- ============================================================
-- 7. jobs.owner_id + RLS de jobs y job_lines
-- ============================================================
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS owner_id uuid;
ALTER TABLE public.jobs ALTER COLUMN owner_id SET DEFAULT auth.uid();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_owner_id_fkey') THEN
    ALTER TABLE public.jobs
      ADD CONSTRAINT jobs_owner_id_fkey FOREIGN KEY (owner_id)
      REFERENCES public.user_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS jobs_owner_idx ON public.jobs (owner_id);

-- Cotizaciones históricas sin dueño -> primer administrador
UPDATE public.jobs
SET owner_id = (SELECT id FROM public.user_profiles WHERE lower(email) = 'ernesto.fernandez@wolkegroup.com' LIMIT 1)
WHERE owner_id IS NULL;

-- Helpers para job_lines (SECURITY DEFINER: evita recursión de RLS sobre jobs)
CREATE OR REPLACE FUNCTION public.job_visible(jid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = jid AND public.puede_ver_registro(j.owner_id));
$$;
REVOKE ALL ON FUNCTION public.job_visible(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.job_visible(uuid) TO authenticated;

-- Reemplazar TODAS las políticas actuales de jobs y job_lines (incluidas las aal2 creadas manualmente)
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('jobs', 'job_lines')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

CREATE POLICY jobs_select ON public.jobs FOR SELECT TO authenticated
  USING (public.is_aal2() AND public.tiene_permiso_objeto('cotizaciones', 'leer') AND public.puede_ver_registro(owner_id));

CREATE POLICY jobs_insert ON public.jobs FOR INSERT TO authenticated
  WITH CHECK (public.is_aal2() AND public.tiene_permiso_objeto('cotizaciones', 'crear') AND owner_id = auth.uid());

-- WITH CHECK sobre la fila nueva: solo puedo reasignar a alguien dentro de mi visibilidad
CREATE POLICY jobs_update ON public.jobs FOR UPDATE TO authenticated
  USING (public.is_aal2() AND public.tiene_permiso_objeto('cotizaciones', 'editar') AND public.puede_ver_registro(owner_id))
  WITH CHECK (public.is_aal2() AND public.tiene_permiso_objeto('cotizaciones', 'editar') AND public.puede_ver_registro(owner_id));

CREATE POLICY jobs_delete ON public.jobs FOR DELETE TO authenticated
  USING (public.is_aal2() AND public.tiene_permiso_objeto('cotizaciones', 'eliminar') AND public.puede_ver_registro(owner_id));

CREATE POLICY job_lines_select ON public.job_lines FOR SELECT TO authenticated
  USING (public.is_aal2() AND public.tiene_permiso_objeto('cotizaciones', 'leer') AND public.job_visible(job_id));

CREATE POLICY job_lines_insert ON public.job_lines FOR INSERT TO authenticated
  WITH CHECK (public.is_aal2() AND public.tiene_permiso_objeto('cotizaciones', 'editar') AND public.job_visible(job_id));

CREATE POLICY job_lines_update ON public.job_lines FOR UPDATE TO authenticated
  USING (public.is_aal2() AND public.tiene_permiso_objeto('cotizaciones', 'editar') AND public.job_visible(job_id))
  WITH CHECK (public.is_aal2() AND public.tiene_permiso_objeto('cotizaciones', 'editar') AND public.job_visible(job_id));

CREATE POLICY job_lines_delete ON public.job_lines FOR DELETE TO authenticated
  USING (public.is_aal2() AND (public.tiene_permiso_objeto('cotizaciones', 'editar') OR public.tiene_permiso_objeto('cotizaciones', 'eliminar')) AND public.job_visible(job_id));

-- Nota: el servicio de Railway y las Edge Functions usan service_role y no pasan por RLS.