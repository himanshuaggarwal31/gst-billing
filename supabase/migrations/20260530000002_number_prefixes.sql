-- ============================================================
-- Document Number Prefixes
-- Allows each user to customise invoice/quotation number prefix
-- e.g. INV-, QUO-, AINV-, AUQ-001 etc.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS invoice_prefix    TEXT NOT NULL DEFAULT 'INV-',
  ADD COLUMN IF NOT EXISTS quotation_prefix  TEXT NOT NULL DEFAULT 'QUO-';
