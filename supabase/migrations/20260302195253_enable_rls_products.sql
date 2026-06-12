/*
  # Enable RLS on products table and add read policy

  1. Security Changes
    - Enable RLS on `products` table
    - Add SELECT policy for anon role to allow product catalog browsing
      (this is an internal quoting tool - all users need catalog access)

  2. Notes
    - The products table was created without RLS; this migration enables it
    - Only SELECT is permitted for anon; no insert/update/delete
*/

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon to read products for quoting"
  ON products
  FOR SELECT
  TO anon
  USING (true);
