/*
# jobs.nombre_proyecto

## Description
Adds a new text column `nombre_proyecto` to the `jobs` table for storing the project name
of a proposal. Also updates the system list views for Propuestas to include this new column.

## Modified Tables
- `jobs`
  - Added `nombre_proyecto` (text, nullable) — Project name for the proposal.
  - Added index `jobs_nombre_proyecto_idx` on `lower(nombre_proyecto)` for case-insensitive search.

## Modified Data
- `list_views` — Updates columns JSON for the two system Propuestas views
  (id `b0000000-...0001` and `b0000000-...0002`) to include the Proyecto column
  between Cliente and Propuesta.

## Important Notes
1. The column is nullable and has no default — existing rows get NULL.
2. The index uses `lower()` for case-insensitive lookups.
3. No RLS or policy changes needed — `jobs` RLS already covers all columns.
4. Idempotent: uses IF NOT EXISTS for both ALTER and CREATE INDEX.
*/

ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS nombre_proyecto text;

CREATE INDEX IF NOT EXISTS jobs_nombre_proyecto_idx ON public.jobs (lower(nombre_proyecto));

UPDATE public.list_views
SET columns = '[{"field":"cliente","label":"Cliente"},{"field":"nombre_proyecto","label":"Proyecto"},{"field":"referencia","label":"Propuesta"},{"field":"no_cliente","label":"No. cliente"},{"field":"grupo","label":"Grupo"},{"field":"status","label":"Estatus"},{"field":"total_lineas","label":"Líneas"},{"field":"owner_id","label":"Propietario"},{"field":"created_at","label":"Fecha de creación"}]'::jsonb
WHERE id = 'b0000000-0000-0000-0000-000000000001';

UPDATE public.list_views
SET columns = '[{"field":"cliente","label":"Cliente"},{"field":"nombre_proyecto","label":"Proyecto"},{"field":"referencia","label":"Propuesta"},{"field":"no_cliente","label":"No. cliente"},{"field":"grupo","label":"Grupo"},{"field":"status","label":"Estatus"},{"field":"total_lineas","label":"Líneas"},{"field":"created_at","label":"Fecha de creación"}]'::jsonb
WHERE id = 'b0000000-0000-0000-0000-000000000002';