/*
  # Fix security issues

  1. Function Search Path
    - Set `search_path` to empty string on `public.set_updated_at` to prevent
      mutable search_path exploitation

  2. Storage Policy
    - Drop the broad SELECT policy "Public can read app-assets" on `storage.objects`
      that allows listing all files in the bucket. Public buckets already serve
      objects by URL without needing a SELECT policy, and the broad policy exposes
      file listing to any client.
*/

-- Fix 1: Immutable search_path on set_updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$function$;

-- Fix 2: Drop overly broad SELECT policy on storage.objects
DROP POLICY IF EXISTS "Public can read app-assets" ON storage.objects;
