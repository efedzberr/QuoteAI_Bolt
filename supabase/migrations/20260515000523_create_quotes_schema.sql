/*
  # Create Quotes Persistence Schema

  1. New Tables
    - `quotes` - Header for each generated quote
      - `id` (uuid, primary key)
      - `quote_reference` (text, unique) - e.g. "QAI-1715789..."
      - `customer_name` (text)
      - `status` (text) - draft | review | generated | sent
      - `source` (text) - upload | manual
      - `original_file_path` (text) - path in quote-files bucket
      - `original_file_name` (text)
      - `original_file_size` (bigint)
      - `pdf_file_path` (text) - path in quote-pdfs bucket
      - `total_lines` (integer)
      - `flagged_lines` (integer)
      - `matched_lines` (integer)
      - `unmatched_lines` (integer)
      - `high_confidence_lines` (integer)
      - `low_confidence_lines` (integer)
      - `avg_confidence` (numeric)
      - `subtotal` (numeric)
      - `currency` (text)
      - `was_retried` (boolean)
      - `processing_attempts` (integer)
      - `generated_date` (timestamptz)
      - `created_by` (uuid, FK to auth.users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    - `quote_lines` - Line items for each quote (snapshot at creation)
      - `id` (uuid, primary key)
      - `quote_id` (uuid, FK to quotes)
      - `line_index` (integer)
      - `original_text` (text)
      - `matched_product_code` (text)
      - `matched_product_name` (text)
      - `matched_unit_price` (numeric)
      - `unit_of_measure` (text)
      - `quantity` (numeric)
      - `line_total` (numeric)
      - `confidence` (numeric)
      - `was_flagged` (boolean)
      - `was_manual` (boolean)
      - `was_price_overridden` (boolean)
      - `notes` (text)
      - `created_at` (timestamptz)
    - `quote_events` - Audit trail for quote changes and events
      - `id` (uuid, primary key)
      - `quote_id` (uuid, FK to quotes)
      - `event_type` (text) - created | file_uploaded | processed | line_edited | etc.
      - `payload` (jsonb)
      - `actor_id` (uuid, FK to auth.users)
      - `created_at` (timestamptz)

  2. Security
    - RLS enabled on all three tables
    - Policies restrict access to authenticated users who own the quote
    - Storage buckets with user-scoped folder policies

  3. Storage Buckets
    - `quote-files` - Original uploaded files (private, owner-only)
    - `quote-pdfs` - Generated PDF files (private, owner-only)

  4. Other
    - `updated_at` trigger on quotes table
    - Indexes on commonly queried columns
*/

-- ============================================================
-- TABLE: quotes
-- ============================================================
CREATE TABLE IF NOT EXISTS quotes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_reference       text UNIQUE NOT NULL,
  customer_name         text NOT NULL,
  status                text NOT NULL DEFAULT 'draft',
  source                text NOT NULL DEFAULT 'upload',

  original_file_path    text,
  original_file_name    text,
  original_file_size    bigint,
  pdf_file_path         text,

  total_lines           integer NOT NULL DEFAULT 0,
  flagged_lines         integer NOT NULL DEFAULT 0,
  matched_lines         integer NOT NULL DEFAULT 0,
  unmatched_lines       integer NOT NULL DEFAULT 0,
  high_confidence_lines integer NOT NULL DEFAULT 0,
  low_confidence_lines  integer NOT NULL DEFAULT 0,
  avg_confidence        numeric(5,4) DEFAULT 0,
  subtotal              numeric(14,2) NOT NULL DEFAULT 0,
  currency              text NOT NULL DEFAULT 'MXN',

  was_retried           boolean NOT NULL DEFAULT false,
  processing_attempts   integer NOT NULL DEFAULT 1,

  generated_date        timestamptz NOT NULL DEFAULT now(),
  created_by            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quotes_created_by ON quotes (created_by);
CREATE INDEX IF NOT EXISTS idx_quotes_status     ON quotes (status);
CREATE INDEX IF NOT EXISTS idx_quotes_generated  ON quotes (generated_date DESC);
CREATE INDEX IF NOT EXISTS idx_quotes_customer   ON quotes (customer_name);

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own quotes"
  ON quotes FOR SELECT TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Users insert own quotes"
  ON quotes FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users update own quotes"
  ON quotes FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users delete own quotes"
  ON quotes FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- ============================================================
-- TABLE: quote_lines
-- ============================================================
CREATE TABLE IF NOT EXISTS quote_lines (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id                 uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  line_index               integer NOT NULL,

  original_text            text,

  matched_product_code     text,
  matched_product_name     text,
  matched_unit_price       numeric(14,4),
  unit_of_measure          text,

  quantity                 numeric(14,4) NOT NULL DEFAULT 0,
  line_total               numeric(14,2) NOT NULL DEFAULT 0,

  confidence               numeric(5,4) DEFAULT 0,
  was_flagged              boolean NOT NULL DEFAULT false,
  was_manual               boolean NOT NULL DEFAULT false,
  was_price_overridden     boolean NOT NULL DEFAULT false,

  notes                    text,
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quote_lines_quote_id ON quote_lines (quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_lines_code     ON quote_lines (matched_product_code);

ALTER TABLE quote_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read lines of own quotes"
  ON quote_lines FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM quotes WHERE quotes.id = quote_lines.quote_id
    AND quotes.created_by = auth.uid()
  ));

CREATE POLICY "Users insert lines on own quotes"
  ON quote_lines FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM quotes WHERE quotes.id = quote_lines.quote_id
    AND quotes.created_by = auth.uid()
  ));

CREATE POLICY "Users update lines of own quotes"
  ON quote_lines FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM quotes WHERE quotes.id = quote_lines.quote_id
    AND quotes.created_by = auth.uid()
  ));

CREATE POLICY "Users delete lines of own quotes"
  ON quote_lines FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM quotes WHERE quotes.id = quote_lines.quote_id
    AND quotes.created_by = auth.uid()
  ));

-- ============================================================
-- TABLE: quote_events (auditoría)
-- ============================================================
CREATE TABLE IF NOT EXISTS quote_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id    uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  event_type  text NOT NULL,
  payload     jsonb,
  actor_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_quote_id ON quote_events (quote_id, created_at DESC);

ALTER TABLE quote_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read events of own quotes"
  ON quote_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM quotes WHERE quotes.id = quote_events.quote_id
    AND quotes.created_by = auth.uid()
  ));

CREATE POLICY "Users insert events on own quotes"
  ON quote_events FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM quotes WHERE quotes.id = quote_events.quote_id
    AND quotes.created_by = auth.uid()
  ));

-- ============================================================
-- Trigger updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS quotes_set_updated_at ON quotes;
CREATE TRIGGER quotes_set_updated_at
  BEFORE UPDATE ON quotes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Storage buckets
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('quote-files', 'quote-files', false),
  ('quote-pdfs', 'quote-pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- quote-files: private, owner-only access
CREATE POLICY "Users upload own files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'quote-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users read own files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'quote-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users delete own files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'quote-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- quote-pdfs: same policies
CREATE POLICY "Users upload own pdfs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'quote-pdfs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users read own pdfs"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'quote-pdfs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users delete own pdfs"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'quote-pdfs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );