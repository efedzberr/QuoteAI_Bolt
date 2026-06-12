create table jobs (
  id uuid primary key default gen_random_uuid(),
  referencia text not null unique,
  cliente text,
  status text not null default 'procesando',
  total_lineas int default 0,
  progreso int default 0,
  payload jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_jobs" ON jobs FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "insert_jobs" ON jobs FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "update_jobs" ON jobs FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_jobs" ON jobs FOR DELETE
  TO authenticated USING (true);
