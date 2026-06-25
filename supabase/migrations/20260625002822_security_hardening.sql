-- =============================================================
-- Security hardening migration
-- =============================================================

-- 1. Move pg_trgm from public to extensions schema
-- Must drop dependent indexes first, then recreate
DROP INDEX IF EXISTS public.idx_products_desccorta_trgm;
DROP INDEX IF EXISTS public.idx_products_desclarga_trgm;
DROP EXTENSION IF EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;

-- Recreate trigram indexes referencing extensions schema
CREATE INDEX idx_products_desccorta_trgm
  ON public.products USING gin ("DescCortaArt" extensions.gin_trgm_ops);
CREATE INDEX idx_products_desclarga_trgm
  ON public.products USING gin ("DescLargaArt" extensions.gin_trgm_ops);

-- 2. Revoke ALL from anon on sensitive tables (keep products SELECT for catalog search)
REVOKE ALL ON public.app_logs FROM anon;
REVOKE ALL ON public.app_settings FROM anon;
REVOKE ALL ON public.job_lines FROM anon;
REVOKE ALL ON public.jobs FROM anon;
REVOKE ALL ON public.productos_nuevos FROM anon;
REVOKE ALL ON public.quote_events FROM anon;
REVOKE ALL ON public.quote_lines FROM anon;
REVOKE ALL ON public.quotes FROM anon;
REVOKE ALL ON public.products_backup_2026_05_26 FROM anon;
REVOKE ALL ON public.products_backup_2026_06_12 FROM anon;

-- Keep products SELECT for anon (InlineProductSearch uses anon key)
-- Revoke write privileges from anon on products
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.products FROM anon;

-- 3. Tighten RLS on jobs
DROP POLICY IF EXISTS "insert_jobs" ON public.jobs;
CREATE POLICY "insert_jobs" ON public.jobs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "update_jobs" ON public.jobs;
CREATE POLICY "update_jobs" ON public.jobs FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "delete_jobs" ON public.jobs;
CREATE POLICY "delete_jobs" ON public.jobs FOR DELETE
  TO authenticated USING (auth.uid() IS NOT NULL);

-- 4. Tighten RLS on job_lines
DROP POLICY IF EXISTS "insert_job_lines" ON public.job_lines;
CREATE POLICY "insert_job_lines" ON public.job_lines FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "update_job_lines" ON public.job_lines;
CREATE POLICY "update_job_lines" ON public.job_lines FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "delete_job_lines" ON public.job_lines;
CREATE POLICY "delete_job_lines" ON public.job_lines FOR DELETE
  TO authenticated USING (auth.uid() IS NOT NULL);

-- 5. Tighten RLS on productos_nuevos
DROP POLICY IF EXISTS "insert_productos_nuevos" ON public.productos_nuevos;
CREATE POLICY "insert_productos_nuevos" ON public.productos_nuevos FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "update_productos_nuevos" ON public.productos_nuevos;
CREATE POLICY "update_productos_nuevos" ON public.productos_nuevos FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "delete_productos_nuevos" ON public.productos_nuevos;
CREATE POLICY "delete_productos_nuevos" ON public.productos_nuevos FOR DELETE
  TO authenticated USING (auth.uid() IS NOT NULL);

-- 6. Fix get_product_facets: SECURITY INVOKER (relies on table RLS)
CREATE OR REPLACE FUNCTION public.get_product_facets()
RETURNS TABLE(marca text, depto text, categoria text, subcategoria text)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT DISTINCT
    "Marca"::text AS marca,
    "DeptoArt"::text AS depto,
    "CategoriaArt"::text AS categoria,
    "SubCategoriaArt"::text AS subcategoria
  FROM products
  WHERE "Marca" IS NOT NULL
     OR "CategoriaArt" IS NOT NULL
     OR "SubCategoriaArt" IS NOT NULL;
$$;

-- 7. Remove overly-broad storage policies for app-assets
DROP POLICY IF EXISTS "Anyone can delete app-assets" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update app-assets" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload to app-assets" ON storage.objects;

-- 8. Remove the broad app_assets_select policy (public bucket serves files via URL anyway)
DROP POLICY IF EXISTS "app_assets_select" ON storage.objects;
