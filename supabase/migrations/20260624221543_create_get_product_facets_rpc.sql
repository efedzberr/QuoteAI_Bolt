CREATE OR REPLACE FUNCTION public.get_product_facets()
RETURNS TABLE(marca text, depto text, categoria text, subcategoria text)
LANGUAGE sql STABLE SECURITY DEFINER
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