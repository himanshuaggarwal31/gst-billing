-- ============================================================
-- 1. Register 'challans' feature + plan assignments
-- ============================================================
INSERT INTO public.features (id, name, description, module)
VALUES ('challans', 'Delivery Challans', 'Goods movement between warehouse and project sites', 'billing')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.plan_features (plan_id, feature_id, limits)
VALUES ('starter','challans','{}'),('pro','challans','{}'),('ca','challans','{}'),('enterprise','challans','{}')
ON CONFLICT (plan_id, feature_id) DO NOTHING;

-- ============================================================
-- 2. Add E-Way Bill columns to challans table
--    (Run this after 20260601000001_challans.sql)
-- ============================================================
ALTER TABLE public.challans
  ADD COLUMN IF NOT EXISTS eway_bill_number     TEXT,
  ADD COLUMN IF NOT EXISTS eway_bill_valid_until DATE,
  ADD COLUMN IF NOT EXISTS transport_mode        TEXT DEFAULT 'road'
    CHECK (transport_mode IN ('road', 'rail', 'air', 'ship')),
  ADD COLUMN IF NOT EXISTS distance_km           INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transporter_gstin     TEXT;