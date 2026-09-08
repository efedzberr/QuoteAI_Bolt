/*
# Vistas de lista (list_views) + objetos grupos / precio_grupo en perfiles

## Summary
Creates a generic "list views" system (Salesforce-style) for saved filters, columns, and sorting per object.
Extends the profile permissions matrix with two new objects: grupos and precio_grupo.
Replaces RLS policies on grupo and precio_grupo to use profile-based permissions.
Seeds system list views for propuestas, grupos, productos, and precio_grupo.

## New Tables
- `list_views` — saved list views per object (propuestas, grupos, productos, precio_grupo).
  Stores filters (JSONB array), filter_logic (text expression like "1 AND (2 OR 3)"),
  columns (JSONB array), sorting (JSONB array). Can be private (owner only), public (admin-created),
  or system (seeded, non-editable).
- `user_list_view_preferences` — per-user per-object preferences: pinned view, recent views,
  display preferences (density, etc.).

## Modified Tables
- `perfil_permisos_objeto` — CHECK constraint expanded to include 'grupos' and 'precio_grupo'.
  Existing profiles receive read-only permissions; Administrador profile receives full CRUD.

## Security Changes
- RLS enabled on list_views and user_list_view_preferences with appropriate policies.
- All existing policies on grupo and precio_grupo are dropped and replaced with
  profile-permission-based policies (2FA + tiene_permiso_objeto).
- New indexes on precio_grupo and grupo for UI filtering performance.

## Important Notes
1. The products table is NOT touched.
2. grupo and precio_grupo data and columns are NOT altered — only RLS policies change.
3. Railway service and Edge Functions use service_role and bypass RLS.
4. System list views use deterministic UUIDs (b0000000-...-000001 through 000006).
*/

-- ============================================================
-- 1. list_views
-- ============================================================
CREATE TABLE IF NOT EXISTS public.list_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  object text NOT NULL,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  is_system boolean NOT NULL DEFAULT false,
  filters jsonb NOT NULL DEFAULT '[]'::jsonb,
  filter_logic text,
  columns jsonb NOT NULL DEFAULT '[]'::jsonb,
  sorting jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT list_views_name_len CHECK (char_length(btrim(name)) BETWEEN 1 AND 80)
);

CREATE INDEX IF NOT EXISTS list_views_object_idx ON public.list_views (object);
CREATE INDEX IF NOT EXISTS list_views_owner_idx ON public.list_views (owner_user_id);

ALTER TABLE public.list_views ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.list_views FROM anon;

DROP TRIGGER IF EXISTS trg_list_views_updated_at ON public.list_views;
CREATE TRIGGER trg_list_views_updated_at
  BEFORE UPDATE ON public.list_views
  FOR EACH ROW EXECUTE FUNCTION public.user_profiles_set_updated_at();

DROP POLICY IF EXISTS list_views_select ON public.list_views;
CREATE POLICY list_views_select ON public.list_views FOR SELECT TO authenticated
  USING (public.is_aal2() AND (is_system OR visibility = 'public' OR owner_user_id = auth.uid()));

DROP POLICY IF EXISTS list_views_insert ON public.list_views;
CREATE POLICY list_views_insert ON public.list_views FOR INSERT TO authenticated
  WITH CHECK (
    public.is_aal2()
    AND owner_user_id = auth.uid()
    AND is_system = false
    AND (visibility = 'private' OR public.is_admin())
  );

DROP POLICY IF EXISTS list_views_update ON public.list_views;
CREATE POLICY list_views_update ON public.list_views FOR UPDATE TO authenticated
  USING (
    public.is_aal2() AND is_system = false
    AND (owner_user_id = auth.uid() OR (visibility = 'public' AND public.is_admin()))
  )
  WITH CHECK (
    public.is_aal2() AND is_system = false
    AND (visibility = 'private' OR public.is_admin())
  );

DROP POLICY IF EXISTS list_views_delete ON public.list_views;
CREATE POLICY list_views_delete ON public.list_views FOR DELETE TO authenticated
  USING (
    public.is_aal2() AND is_system = false
    AND (owner_user_id = auth.uid() OR (visibility = 'public' AND public.is_admin()))
  );

-- ============================================================
-- 2. user_list_view_preferences
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_list_view_preferences (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  object text NOT NULL,
  pinned_list_view_id uuid REFERENCES public.list_views(id) ON DELETE SET NULL,
  recent_list_view_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  display_prefs jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (user_id, object)
);

ALTER TABLE public.user_list_view_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_list_view_preferences FROM anon;

DROP POLICY IF EXISTS ulvp_all_own ON public.user_list_view_preferences;
CREATE POLICY ulvp_all_own ON public.user_list_view_preferences FOR ALL TO authenticated
  USING (public.is_aal2() AND user_id = auth.uid())
  WITH CHECK (public.is_aal2() AND user_id = auth.uid());

-- ============================================================
-- 3. Objetos nuevos en la matriz de perfiles
-- ============================================================
ALTER TABLE public.perfil_permisos_objeto DROP CONSTRAINT IF EXISTS perfil_permisos_objeto_object_name_check;
ALTER TABLE public.perfil_permisos_objeto
  ADD CONSTRAINT perfil_permisos_objeto_object_name_check
  CHECK (object_name IN ('cotizaciones', 'productos_nuevos', 'grupos', 'precio_grupo'));

-- Administrador: todo. Demas perfiles existentes: solo Leer.
INSERT INTO public.perfil_permisos_objeto (perfil_id, object_name, can_read, can_create, can_edit, can_delete)
SELECT p.id, o.object_name, true, p.is_system, p.is_system, p.is_system
FROM public.perfiles p CROSS JOIN (VALUES ('grupos'), ('precio_grupo')) AS o(object_name)
ON CONFLICT (perfil_id, object_name) DO NOTHING;

-- ============================================================
-- 4. RLS de grupo y precio_grupo por permiso de objeto
-- ============================================================
ALTER TABLE public.grupo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.precio_grupo ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.grupo FROM anon;
REVOKE ALL ON public.precio_grupo FROM anon;

DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('grupo', 'precio_grupo')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

CREATE POLICY grupo_select ON public.grupo FOR SELECT TO authenticated
  USING (public.is_aal2() AND public.tiene_permiso_objeto('grupos', 'leer'));
CREATE POLICY grupo_insert ON public.grupo FOR INSERT TO authenticated
  WITH CHECK (public.is_aal2() AND public.tiene_permiso_objeto('grupos', 'crear'));
CREATE POLICY grupo_update ON public.grupo FOR UPDATE TO authenticated
  USING (public.is_aal2() AND public.tiene_permiso_objeto('grupos', 'editar'))
  WITH CHECK (public.is_aal2() AND public.tiene_permiso_objeto('grupos', 'editar'));
CREATE POLICY grupo_delete ON public.grupo FOR DELETE TO authenticated
  USING (public.is_aal2() AND public.tiene_permiso_objeto('grupos', 'eliminar'));

CREATE POLICY precio_grupo_select ON public.precio_grupo FOR SELECT TO authenticated
  USING (public.is_aal2() AND public.tiene_permiso_objeto('precio_grupo', 'leer'));
CREATE POLICY precio_grupo_insert ON public.precio_grupo FOR INSERT TO authenticated
  WITH CHECK (public.is_aal2() AND public.tiene_permiso_objeto('precio_grupo', 'crear'));
CREATE POLICY precio_grupo_update ON public.precio_grupo FOR UPDATE TO authenticated
  USING (public.is_aal2() AND public.tiene_permiso_objeto('precio_grupo', 'editar'))
  WITH CHECK (public.is_aal2() AND public.tiene_permiso_objeto('precio_grupo', 'editar'));
CREATE POLICY precio_grupo_delete ON public.precio_grupo FOR DELETE TO authenticated
  USING (public.is_aal2() AND public.tiene_permiso_objeto('precio_grupo', 'eliminar'));

-- Indices para filtros y orden desde la UI (no alteran datos)
CREATE INDEX IF NOT EXISTS precio_grupo_group_name_idx ON public.precio_grupo (group_name);
CREATE INDEX IF NOT EXISTS precio_grupo_codigo_art_idx ON public.precio_grupo (codigo_art);
CREATE INDEX IF NOT EXISTS grupo_no_cliente_idx ON public.grupo (no_cliente);

-- ============================================================
-- 5. Vistas de sistema
-- ============================================================
INSERT INTO public.list_views (id, name, object, owner_user_id, visibility, is_system, filters, filter_logic, columns, sorting) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'Todas las propuestas', 'propuestas', NULL, 'public', true,
   '[]'::jsonb, NULL,
   '[{"field":"referencia","label":"Referencia"},{"field":"cliente","label":"Cliente"},{"field":"no_cliente","label":"No. cliente"},{"field":"grupo","label":"Grupo"},{"field":"status","label":"Estatus"},{"field":"total_lineas","label":"Líneas"},{"field":"owner_id","label":"Propietario"},{"field":"created_at","label":"Fecha de creación"}]'::jsonb,
   '[{"field":"created_at","direction":"desc"}]'::jsonb),
  ('b0000000-0000-0000-0000-000000000002', 'Mis propuestas', 'propuestas', NULL, 'public', true,
   '[{"field":"owner_id","operator":"equals","value":"$CURRENT_USER"}]'::jsonb, NULL,
   '[{"field":"referencia","label":"Referencia"},{"field":"cliente","label":"Cliente"},{"field":"no_cliente","label":"No. cliente"},{"field":"grupo","label":"Grupo"},{"field":"status","label":"Estatus"},{"field":"total_lineas","label":"Líneas"},{"field":"created_at","label":"Fecha de creación"}]'::jsonb,
   '[{"field":"created_at","direction":"desc"}]'::jsonb),
  ('b0000000-0000-0000-0000-000000000003', 'Todos los grupos', 'grupos', NULL, 'public', true,
   '[]'::jsonb, NULL,
   '[{"field":"group_name","label":"Grupo"},{"field":"no_cliente","label":"No. cliente"},{"field":"loaded_at","label":"Cargado"}]'::jsonb,
   '[{"field":"group_name","direction":"asc"}]'::jsonb),
  ('b0000000-0000-0000-0000-000000000004', 'Todos los productos', 'productos', NULL, 'public', true,
   '[]'::jsonb, NULL,
   '[{"field":"CodigoArt","label":"Código"},{"field":"DescCortaArt","label":"Descripción corta"},{"field":"Marca","label":"Marca"},{"field":"UMP","label":"UMP"},{"field":"CategoriaArt","label":"Categoría"},{"field":"Precio","label":"Precio lista"}]'::jsonb,
   '[{"field":"CodigoArt","direction":"asc"}]'::jsonb),
  ('b0000000-0000-0000-0000-000000000005', 'Todos los precios por grupo', 'precio_grupo', NULL, 'public', true,
   '[]'::jsonb, NULL,
   '[{"field":"group_name","label":"Grupo"},{"field":"codigo_art","label":"Código"},{"field":"precio_art","label":"Precio"},{"field":"precio_promo_art","label":"Precio promo"},{"field":"loaded_at","label":"Cargado"}]'::jsonb,
   '[{"field":"group_name","direction":"asc"}]'::jsonb),
  ('b0000000-0000-0000-0000-000000000006', 'Precios con promoción', 'precio_grupo', NULL, 'public', true,
   '[{"field":"precio_promo_art","operator":"gt","value":"0"}]'::jsonb, NULL,
   '[{"field":"group_name","label":"Grupo"},{"field":"codigo_art","label":"Código"},{"field":"precio_art","label":"Precio"},{"field":"precio_promo_art","label":"Precio promo"},{"field":"loaded_at","label":"Cargado"}]'::jsonb,
   '[{"field":"group_name","direction":"asc"}]'::jsonb)
ON CONFLICT (id) DO NOTHING;