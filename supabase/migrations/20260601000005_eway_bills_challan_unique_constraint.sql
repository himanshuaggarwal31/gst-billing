-- Replace the partial unique index on challan_id with a proper UNIQUE constraint.
-- This allows PostgreSQL to use ON CONFLICT (challan_id) in upsert statements,
-- which the partial index (WHERE challan_id IS NOT NULL) does not support.

-- Drop the partial unique index added in the previous migration
DROP INDEX IF EXISTS public.eway_bills_challan_id_key;

-- Add a proper unique constraint.
-- PostgreSQL UNIQUE constraints on nullable columns correctly allow multiple NULLs
-- (each NULL is considered distinct), so existing rows with challan_id IS NULL are unaffected.
ALTER TABLE public.eway_bills
  ADD CONSTRAINT eway_bills_challan_id_unique UNIQUE (challan_id);
