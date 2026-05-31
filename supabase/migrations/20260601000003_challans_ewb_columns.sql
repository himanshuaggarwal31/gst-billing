-- Add E-Way Bill related columns to challans table
ALTER TABLE public.challans
  ADD COLUMN IF NOT EXISTS eway_bill_number     TEXT,
  ADD COLUMN IF NOT EXISTS eway_bill_valid_until DATE,
  ADD COLUMN IF NOT EXISTS transport_mode        TEXT DEFAULT 'road'
    CHECK (transport_mode IN ('road', 'rail', 'air', 'ship')),
  ADD COLUMN IF NOT EXISTS distance_km           INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transporter_gstin     TEXT;
