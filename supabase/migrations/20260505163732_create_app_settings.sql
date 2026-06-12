/*
  # App Settings & Storage Bucket

  1. New Tables
    - `app_settings` (singleton, id=1)
      - `app_logo_url` (text, nullable) - URL of the in-app logo
      - `app_logo_width_px` (integer, default 160)
      - `app_logo_height_px` (integer, default 48)
      - `pdf_logo_url` (text, nullable) - URL of the PDF logo
      - `pdf_logo_width_px` (integer, default 200)
      - `pdf_logo_height_px` (integer, default 80)
      - `confidence_threshold` (numeric, default 0.90) - Threshold below which lines need review
      - `updated_at` (timestamptz, default now())
    - Singleton constraint: only row id=1 allowed
  2. Storage
    - Creates public `app-assets` bucket for logos
    - Public read, authenticated write policies
  3. Security
    - RLS enabled on app_settings
    - Public read (settings are global display config)
    - Authenticated write (anyone logged in can update)
*/

CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  app_logo_url TEXT,
  app_logo_width_px INTEGER DEFAULT 160,
  app_logo_height_px INTEGER DEFAULT 48,
  pdf_logo_url TEXT,
  pdf_logo_width_px INTEGER DEFAULT 200,
  pdf_logo_height_px INTEGER DEFAULT 80,
  confidence_threshold NUMERIC(3,2) DEFAULT 0.90,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT singleton CHECK (id = 1)
);

INSERT INTO app_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read app settings"
  ON app_settings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert app settings"
  ON app_settings FOR INSERT
  TO anon, authenticated
  WITH CHECK (id = 1);

CREATE POLICY "Anyone can update app settings"
  ON app_settings FOR UPDATE
  TO anon, authenticated
  USING (id = 1)
  WITH CHECK (id = 1);

INSERT INTO storage.buckets (id, name, public)
VALUES ('app-assets', 'app-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can read app-assets"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'app-assets');

CREATE POLICY "Anyone can upload to app-assets"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'app-assets');

CREATE POLICY "Anyone can update app-assets"
  ON storage.objects FOR UPDATE
  TO anon, authenticated
  USING (bucket_id = 'app-assets')
  WITH CHECK (bucket_id = 'app-assets');

CREATE POLICY "Anyone can delete app-assets"
  ON storage.objects FOR DELETE
  TO anon, authenticated
  USING (bucket_id = 'app-assets');
