/*
  # Create products table for product lookup

  1. New Tables
    - `products`
      - `id` (uuid, primary key)
      - `product_code` (text, unique) - Internal product SKU/code
      - `product_name` (text) - Display name of the product
      - `unit_price` (numeric) - Price per unit
      - `unit_of_measure` (text) - Unit of measure (PZA, KG, etc.)
      - `category` (text) - Product category for filtering
      - `is_active` (boolean) - Whether product is available
      - `created_at` (timestamptz) - Creation timestamp

  2. Security
    - Enable RLS on `products` table
    - Add policy for anon users to read products (product catalog is public-facing for quoting tool)

  3. Notes
    - This table serves as the product catalog for the QuoteAI quoting tool
    - The anon read policy is intentional: this is an internal tool where all users need to search products
*/

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code text UNIQUE NOT NULL,
  product_name text NOT NULL,
  unit_price numeric NOT NULL DEFAULT 0,
  unit_of_measure text NOT NULL DEFAULT 'PZA',
  category text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read access for quoting tool"
  ON products
  FOR SELECT
  TO anon
  USING (is_active = true);

CREATE INDEX IF NOT EXISTS idx_products_name ON products USING gin (to_tsvector('spanish', product_name));
CREATE INDEX IF NOT EXISTS idx_products_code ON products (product_code);
