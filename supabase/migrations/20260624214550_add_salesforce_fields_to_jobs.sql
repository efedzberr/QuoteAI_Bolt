ALTER TABLE jobs ADD COLUMN IF NOT EXISTS sf_opportunity_id text;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS sf_quote_id text;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS sf_sent_at timestamptz;