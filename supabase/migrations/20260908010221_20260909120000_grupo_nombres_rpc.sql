/*
# Create grupo_nombres() RPC function

## Description
Creates a SECURITY INVOKER function that returns distinct group names with their client count
from the `grupo` table. Used by the frontend group selector in record forms.

## New Functions
- `grupo_nombres()` — Returns table of (group_name text, clientes bigint).
  SECURITY INVOKER so it respects the caller's RLS policies on `grupo`.

## Security
- REVOKE from PUBLIC and anon; GRANT EXECUTE only to authenticated.
- Uses SECURITY INVOKER (not DEFINER) so RLS on `grupo` is enforced.
- search_path pinned to `public`.

## Important Notes
1. This function is idempotent via CREATE OR REPLACE.
2. The frontend calls this via supabase.rpc('grupo_nombres') to populate
   the group selector in Nuevo grupo / Nuevo precio forms.
*/

CREATE OR REPLACE FUNCTION public.grupo_nombres()
RETURNS TABLE (group_name text, clientes bigint)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT g.group_name, count(*)::bigint AS clientes
  FROM public.grupo g
  GROUP BY g.group_name
  ORDER BY g.group_name;
$$;

REVOKE ALL ON FUNCTION public.grupo_nombres() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grupo_nombres() TO authenticated;
