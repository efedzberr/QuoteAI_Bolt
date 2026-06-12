/*
  # Recreate products table with correct column schema

  ## Summary
  The existing products table was created with English column names, but all application
  code expects Spanish/ERP column names. This migration drops the old table and recreates
  it with the proper schema using quoted identifiers to preserve mixed case.

  ## New Table: products
  Columns matching the ERP system naming convention (quoted to preserve case):
  - "CodigoArt": Product code / SKU
  - "DescCortaArt": Short description for display and search
  - "DescLargaArt": Long/full description
  - "Precio": Unit price
  - "UMP": Unit of measure (PZ, KG, MT, etc.)
  - "CategoriaArt": Product category
  - "DeptoArt": Department
  - "Marca": Brand / manufacturer
  - "CodBarras": Barcode
  - "ValorAtrib4".."ValorAtrib8": Extra attribute fields

  ## Security
  - RLS enabled
  - Anonymous users can SELECT (required for quoting tool)
  - Only authenticated users can INSERT/UPDATE
*/

DROP TABLE IF EXISTS products;

CREATE TABLE products (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "CodigoArt"     text NOT NULL DEFAULT '',
  "DescCortaArt"  text NOT NULL DEFAULT '',
  "DescLargaArt"  text DEFAULT '',
  "Precio"        numeric(14,4) DEFAULT 0,
  "UMP"           text DEFAULT 'PZ',
  "CategoriaArt"  text DEFAULT '',
  "DeptoArt"      text DEFAULT '',
  "Marca"         text DEFAULT '',
  "CodBarras"     text DEFAULT '',
  "ValorAtrib4"   text DEFAULT '',
  "ValorAtrib5"   text DEFAULT '',
  "ValorAtrib6"   text DEFAULT '',
  "ValorAtrib7"   text DEFAULT '',
  "ValorAtrib8"   text DEFAULT '',
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_products_codigo     ON products ("CodigoArt");
CREATE INDEX idx_products_desc_corta ON products ("DescCortaArt");
CREATE INDEX idx_products_marca      ON products ("Marca");
CREATE INDEX idx_products_categoria  ON products ("CategoriaArt");
CREATE INDEX idx_products_depto      ON products ("DeptoArt");

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon users can read products"
  ON products FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Authenticated users can read products"
  ON products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update products"
  ON products FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
