
create table productos_nuevos (
  id uuid primary key default gen_random_uuid(),
  codigo text,
  descripcion_corta text not null,
  descripcion_larga text,
  marca text not null,
  unidad_medida text not null,
  precio_unitario numeric(12,2) not null check (precio_unitario > 0),
  departamento text,
  categoria text,
  subcategoria text,
  peso numeric,
  ancho numeric,
  alto numeric,
  profundidad numeric,
  garantia text,
  codigo_barras text,
  created_at timestamptz not null default now()
);

ALTER TABLE productos_nuevos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_productos_nuevos" ON productos_nuevos FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "insert_productos_nuevos" ON productos_nuevos FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "update_productos_nuevos" ON productos_nuevos FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_productos_nuevos" ON productos_nuevos FOR DELETE
  TO authenticated USING (true);
