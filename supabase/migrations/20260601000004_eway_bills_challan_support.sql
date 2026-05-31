-- Allow eway_bills to be linked to either an invoice OR a challan.
-- Makes the e-Way Bill infrastructure reusable across document types.

-- 1. Make invoice_id nullable (currently NOT NULL)
ALTER TABLE public.eway_bills
  ALTER COLUMN invoice_id DROP NOT NULL;

-- 2. Add challan_id column
ALTER TABLE public.eway_bills
  ADD COLUMN IF NOT EXISTS challan_id UUID REFERENCES public.challans(id) ON DELETE CASCADE;

-- 3. Ensure exactly one of invoice_id / challan_id is set
ALTER TABLE public.eway_bills
  ADD CONSTRAINT eway_bills_entity_check
    CHECK (
      (invoice_id IS NOT NULL AND challan_id IS NULL) OR
      (invoice_id IS NULL     AND challan_id IS NOT NULL)
    );

-- 4. Unique index so each challan can have at most one e-Way Bill record
CREATE UNIQUE INDEX IF NOT EXISTS eway_bills_challan_id_key
  ON public.eway_bills(challan_id)
  WHERE challan_id IS NOT NULL;

-- 5. Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_eway_bills_challan_id ON public.eway_bills(challan_id);
