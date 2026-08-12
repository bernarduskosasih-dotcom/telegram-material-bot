-- ============================================================
-- Jalankan SQL ini di Supabase → SQL Editor
-- ============================================================

-- Tabel utama: pemakaian bahan
CREATE TABLE material_usage (
  id BIGSERIAL PRIMARY KEY,
  material_id TEXT NOT NULL,
  material_name TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit TEXT NOT NULL,
  order_note TEXT DEFAULT '-',
  operator_id TEXT NOT NULL,
  operator_name TEXT NOT NULL,
  reported_at TIMESTAMPTZ DEFAULT NOW(),
  report_date DATE DEFAULT CURRENT_DATE
);

-- Index untuk query harian
CREATE INDEX idx_material_usage_date ON material_usage(report_date);
CREATE INDEX idx_material_usage_operator ON material_usage(operator_id);

-- Tabel session: menyimpan state percakapan bot
CREATE TABLE sessions (
  chat_id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-cleanup session lama (lebih dari 1 jam)
-- Bisa dijalankan via Supabase CRON atau manual
-- DELETE FROM sessions WHERE updated_at < NOW() - INTERVAL '1 hour';

-- ============================================================
-- Row Level Security (RLS) - PENTING untuk keamanan
-- ============================================================

-- Enable RLS
ALTER TABLE material_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Policy: allow anon key to insert and select (bot pakai anon key)
CREATE POLICY "Bot can insert material_usage"
  ON material_usage FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Bot can read material_usage"
  ON material_usage FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Bot can manage sessions"
  ON sessions FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- View untuk ringkasan harian (opsional, untuk dashboard)
-- ============================================================
CREATE OR REPLACE VIEW daily_summary AS
SELECT
  report_date,
  material_name,
  unit,
  SUM(quantity) as total_quantity,
  COUNT(*) as entry_count,
  STRING_AGG(DISTINCT operator_name, ', ') as operators
FROM material_usage
GROUP BY report_date, material_name, unit
ORDER BY report_date DESC, material_name;
