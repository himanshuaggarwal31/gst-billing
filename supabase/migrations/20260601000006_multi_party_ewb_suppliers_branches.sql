-- =============================================================================
-- ALL PENDING MIGRATIONS — run this once in Supabase SQL editor
-- Covers: multi-party EWB (Dispatch From / Ship To), Suppliers, Client Branches
-- =============================================================================


-- ── 1. Add GSTIN + location detail fields to locations ──────────────────────
-- (needed so locations can appear in EWB NIC JSON with full address block)

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS gstin      text,
  ADD COLUMN IF NOT EXISTS city       text,
  ADD COLUMN IF NOT EXISTS state_code char(2),
  ADD COLUMN IF NOT EXISTS pincode    char(6);


-- ── 2. Add first two party FK columns to eway_bills ─────────────────────────
-- (dispatch_from_location_id + ship_to_client_id — the "simple" scenarios)

ALTER TABLE public.eway_bills
  ADD COLUMN IF NOT EXISTS dispatch_from_location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ship_to_client_id         uuid REFERENCES public.clients(id)   ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_eway_bills_dispatch_from ON public.eway_bills(dispatch_from_location_id);
CREATE INDEX IF NOT EXISTS idx_eway_bills_ship_to       ON public.eway_bills(ship_to_client_id);


-- ── 3. shared updated_at trigger function (idempotent) ───────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- ── 4. Client Branches table ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.client_branches (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
  client_id   UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  label       TEXT        NOT NULL,
  gstin       TEXT,
  address     TEXT,
  city        TEXT,
  state_code  CHAR(2),
  pincode     CHAR(6),
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_branches_user_id   ON public.client_branches(user_id);
CREATE INDEX IF NOT EXISTS idx_client_branches_client_id ON public.client_branches(client_id);

ALTER TABLE public.client_branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own client branches" ON public.client_branches;
CREATE POLICY "Users manage own client branches"
  ON public.client_branches
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS trg_client_branches_updated_at ON public.client_branches;
CREATE TRIGGER trg_client_branches_updated_at
  BEFORE UPDATE ON public.client_branches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── 5. Suppliers table ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.suppliers (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  gstin       TEXT,
  address     TEXT,
  city        TEXT,
  state_code  CHAR(2),
  pincode     CHAR(6),
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_user_id ON public.suppliers(user_id);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own suppliers" ON public.suppliers;
CREATE POLICY "Users manage own suppliers"
  ON public.suppliers
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS trg_suppliers_updated_at ON public.suppliers;
CREATE TRIGGER trg_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── 6. Add remaining party FK columns to eway_bills ─────────────────────────
-- (dispatch_from_supplier_id, ship_to_branch_id, ship_to_location_id)

ALTER TABLE public.eway_bills
  ADD COLUMN IF NOT EXISTS dispatch_from_supplier_id UUID REFERENCES public.suppliers(id)       ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ship_to_branch_id         UUID REFERENCES public.client_branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ship_to_location_id       UUID REFERENCES public.locations(id)       ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_eway_bills_dispatch_supplier ON public.eway_bills(dispatch_from_supplier_id);
CREATE INDEX IF NOT EXISTS idx_eway_bills_ship_to_branch    ON public.eway_bills(ship_to_branch_id);
CREATE INDEX IF NOT EXISTS idx_eway_bills_ship_to_location  ON public.eway_bills(ship_to_location_id);

-- DB-level mutual exclusivity constraints (drop first so re-runs are safe)
ALTER TABLE public.eway_bills
  DROP CONSTRAINT IF EXISTS chk_ewb_dispatch_from_exclusive,
  DROP CONSTRAINT IF EXISTS chk_ewb_ship_to_exclusive;

ALTER TABLE public.eway_bills
  ADD CONSTRAINT chk_ewb_dispatch_from_exclusive
    CHECK (
      (dispatch_from_location_id IS NOT NULL)::int +
      (dispatch_from_supplier_id IS NOT NULL)::int <= 1
    ),
  ADD CONSTRAINT chk_ewb_ship_to_exclusive
    CHECK (
      (ship_to_client_id   IS NOT NULL)::int +
      (ship_to_branch_id   IS NOT NULL)::int +
      (ship_to_location_id IS NOT NULL)::int <= 1
    );


-- ── 7. Feature gate entries ──────────────────────────────────────────────────

INSERT INTO public.features (id, name, description, module) VALUES
  ('suppliers',       'Suppliers',       'Manage supplier directory for triangular supply EWB', 'core'),
  ('client_branches', 'Client Branches', 'Manage multi-GSTIN branches per client for EWB',     'core')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.plan_features (plan_id, feature_id, limits) VALUES
  ('pro',        'suppliers',       '{}'),
  ('pro',        'client_branches', '{}'),
  ('ca',         'suppliers',       '{}'),
  ('ca',         'client_branches', '{}'),
  ('enterprise', 'suppliers',       '{}'),
  ('enterprise', 'client_branches', '{}')
ON CONFLICT (plan_id, feature_id) DO NOTHING;
