-- ============================================================
-- Feature Access Management System
-- Super Admin RBAC + Plan-based Feature Gating
-- ============================================================

-- ============================================================
-- 1. EXTEND PROFILES: add super-admin flag
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false;

-- Drop the old hardcoded CHECK so the plans table becomes the authority
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_plan_check;

-- ============================================================
-- 2. PLANS (canonical plan definitions)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.plans (
  id          TEXT PRIMARY KEY,              -- 'free', 'starter', 'pro', 'ca', 'enterprise'
  name        TEXT NOT NULL,
  description TEXT,
  price_monthly  NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_yearly   NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.plans (id, name, description, price_monthly, price_yearly, sort_order) VALUES
  ('free',       'Free',         'Get started with basic invoicing',            0,     0,     0),
  ('starter',    'Starter',      'For growing businesses',                      499,   4990,  1),
  ('pro',        'Pro',          'Advanced features for professionals',         999,   9990,  2),
  ('ca',         'CA / Accountant', 'For chartered accountants managing multiple clients', 1499, 14990, 3),
  ('enterprise', 'Enterprise',   'Full access for large businesses',            2499,  24990, 4)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 3. FEATURES (registry — add new features here as the app grows)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.features (
  id          TEXT PRIMARY KEY,  -- slug like 'invoices', 'gst_reports'
  name        TEXT NOT NULL,
  description TEXT,
  module      TEXT NOT NULL DEFAULT 'core',  -- 'core' | 'billing' | 'compliance' | 'reporting' | 'team'
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.features (id, name, description, module) VALUES
  ('invoices',          'Invoices',             'Create and manage GST invoices',                'billing'),
  ('quotations',        'Quotations',           'Create and manage quotations/proforma invoices', 'billing'),
  ('clients',           'Clients',              'Manage client database',                        'core'),
  ('products',          'Products',             'Manage product/service catalog',                'core'),
  ('expenses',          'Expenses',             'Track business expenses with GST',              'billing'),
  ('recurring',         'Recurring Invoices',   'Auto-generate recurring invoices',              'billing'),
  ('credit_notes',      'Credit Notes',         'Issue credit notes against invoices',           'billing'),
  ('payments',          'Payment Tracking',     'Record payments against invoices',              'billing'),
  ('gst_reports',       'GST Reports',          'GSTR-1, GSTR-3B reports',                       'compliance'),
  ('eway_bills',        'E-Way Bills',          'Generate and manage e-way bills',               'compliance'),
  ('e_invoices',        'E-Invoicing',          'IRP e-invoice generation and management',       'compliance'),
  ('analytics',         'Analytics',            'Business analytics and revenue dashboard',      'reporting'),
  ('aging_reports',     'Aging Reports',        'Accounts receivable aging analysis',            'reporting'),
  ('import',            'Data Import',          'Bulk import clients, products, invoices',       'core'),
  ('team',              'Team Access',          'Invite and manage team members',                'team'),
  ('pdf_customization', 'PDF Customization',    'Custom themes, accent colors, and footers',     'billing'),
  ('admin_panel',       'Admin Panel',          'Super Admin control panel (internal)',          'admin')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 4. PLAN-FEATURE MAPPING
-- limits JSONB holds per-plan caps: -1 means unlimited
-- ============================================================
CREATE TABLE IF NOT EXISTS public.plan_features (
  plan_id    TEXT NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  feature_id TEXT NOT NULL REFERENCES public.features(id) ON DELETE CASCADE,
  limits     JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (plan_id, feature_id)
);

INSERT INTO public.plan_features (plan_id, feature_id, limits) VALUES
  -- ── FREE ──────────────────────────────────────────────────
  ('free', 'invoices',      '{"per_month": 50}'),
  ('free', 'clients',       '{"max": 50}'),
  ('free', 'products',      '{"max": 50}'),
  ('free', 'quotations',    '{"per_month": 10}'),
  ('free', 'payments',      '{}'),
  ('free', 'gst_reports',   '{}'),

  -- ── STARTER ───────────────────────────────────────────────
  ('starter', 'invoices',          '{"per_month": 200}'),
  ('starter', 'clients',           '{"max": 500}'),
  ('starter', 'products',          '{"max": 500}'),
  ('starter', 'quotations',        '{"per_month": 50}'),
  ('starter', 'expenses',          '{}'),
  ('starter', 'credit_notes',      '{}'),
  ('starter', 'recurring',         '{"max_templates": 5}'),
  ('starter', 'payments',          '{}'),
  ('starter', 'gst_reports',       '{}'),
  ('starter', 'pdf_customization', '{}'),
  ('starter', 'import',            '{}'),

  -- ── PRO ───────────────────────────────────────────────────
  ('pro', 'invoices',          '{"per_month": 1000}'),
  ('pro', 'clients',           '{"max": 2000}'),
  ('pro', 'products',          '{"max": 2000}'),
  ('pro', 'quotations',        '{"per_month": 200}'),
  ('pro', 'expenses',          '{}'),
  ('pro', 'credit_notes',      '{}'),
  ('pro', 'recurring',         '{"max_templates": 20}'),
  ('pro', 'payments',          '{}'),
  ('pro', 'gst_reports',       '{}'),
  ('pro', 'eway_bills',        '{}'),
  ('pro', 'e_invoices',        '{}'),
  ('pro', 'analytics',         '{}'),
  ('pro', 'aging_reports',     '{}'),
  ('pro', 'import',            '{}'),
  ('pro', 'team',              '{"max_members": 3}'),
  ('pro', 'pdf_customization', '{}'),

  -- ── CA ────────────────────────────────────────────────────
  ('ca', 'invoices',          '{"per_month": -1}'),
  ('ca', 'clients',           '{"max": -1}'),
  ('ca', 'products',          '{"max": -1}'),
  ('ca', 'quotations',        '{"per_month": -1}'),
  ('ca', 'expenses',          '{}'),
  ('ca', 'credit_notes',      '{}'),
  ('ca', 'recurring',         '{"max_templates": -1}'),
  ('ca', 'payments',          '{}'),
  ('ca', 'gst_reports',       '{}'),
  ('ca', 'eway_bills',        '{}'),
  ('ca', 'e_invoices',        '{}'),
  ('ca', 'analytics',         '{}'),
  ('ca', 'aging_reports',     '{}'),
  ('ca', 'import',            '{}'),
  ('ca', 'team',              '{"max_members": 10}'),
  ('ca', 'pdf_customization', '{}'),

  -- ── ENTERPRISE ────────────────────────────────────────────
  ('enterprise', 'invoices',          '{"per_month": -1}'),
  ('enterprise', 'clients',           '{"max": -1}'),
  ('enterprise', 'products',          '{"max": -1}'),
  ('enterprise', 'quotations',        '{"per_month": -1}'),
  ('enterprise', 'expenses',          '{}'),
  ('enterprise', 'credit_notes',      '{}'),
  ('enterprise', 'recurring',         '{"max_templates": -1}'),
  ('enterprise', 'payments',          '{}'),
  ('enterprise', 'gst_reports',       '{}'),
  ('enterprise', 'eway_bills',        '{}'),
  ('enterprise', 'e_invoices',        '{}'),
  ('enterprise', 'analytics',         '{}'),
  ('enterprise', 'aging_reports',     '{}'),
  ('enterprise', 'import',            '{}'),
  ('enterprise', 'team',              '{"max_members": -1}'),
  ('enterprise', 'pdf_customization', '{}')
ON CONFLICT (plan_id, feature_id) DO NOTHING;

-- ============================================================
-- 5. SUBSCRIPTIONS (source of truth for plan assignment)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id        TEXT NOT NULL REFERENCES public.plans(id),
  status         TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'trial', 'cancelled', 'expired', 'past_due')),
  started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at     TIMESTAMPTZ,           -- NULL = indefinite
  trial_ends_at  TIMESTAMPTZ,
  cancelled_at   TIMESTAMPTZ,
  notes          TEXT,                  -- Super Admin notes
  created_by     UUID REFERENCES auth.users(id),  -- who created/changed
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status  ON public.subscriptions(status);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions"
  ON public.subscriptions FOR SELECT
  USING (user_id = auth.uid());

-- ── Trigger: keep profiles.plan in sync when subscription changes ──────────
CREATE OR REPLACE FUNCTION public.sync_plan_from_subscription()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Only sync for active/trial subscriptions
  IF NEW.status IN ('active', 'trial') THEN
    UPDATE public.profiles SET plan = NEW.plan_id WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_sync_plan_on_subscription_upsert
  AFTER INSERT OR UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.sync_plan_from_subscription();

-- ── Backfill: create 'free' subscriptions for every existing profile ────────
INSERT INTO public.subscriptions (user_id, plan_id, status, started_at)
SELECT id, 'free', 'active', now()
FROM   public.profiles
WHERE  NOT EXISTS (
  SELECT 1 FROM public.subscriptions s WHERE s.user_id = profiles.id
);

-- ── Trigger: create 'free' subscription for every new user ─────────────────
CREATE OR REPLACE FUNCTION public.create_free_subscription_for_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, plan_id, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_new_user_free_subscription
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.create_free_subscription_for_new_user();

-- ============================================================
-- 6. USER FEATURE OVERRIDES (Super Admin manual grants/revokes)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_feature_overrides (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_id  TEXT NOT NULL REFERENCES public.features(id) ON DELETE CASCADE,
  is_enabled  BOOLEAN NOT NULL,  -- true = force ON, false = force OFF
  limits      JSONB,             -- optional limit override (NULL = use plan defaults)
  reason      TEXT,
  expires_at  TIMESTAMPTZ,       -- NULL = permanent
  granted_by  UUID NOT NULL REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, feature_id)
);

CREATE INDEX IF NOT EXISTS idx_ufo_user_id    ON public.user_feature_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_ufo_expires_at ON public.user_feature_overrides(expires_at);

ALTER TABLE public.user_feature_overrides ENABLE ROW LEVEL SECURITY;
-- No user-facing RLS — all access via service-role key at API layer

-- ============================================================
-- 7. FEATURE AUDIT LOGS (immutable append-only log)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.feature_audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id        UUID NOT NULL REFERENCES auth.users(id),
  actor_email     TEXT NOT NULL,
  target_user_id  UUID REFERENCES auth.users(id),
  target_email    TEXT,
  feature_id      TEXT REFERENCES public.features(id),
  action          TEXT NOT NULL CHECK (action IN (
                    'grant_feature',
                    'revoke_feature',
                    'update_override',
                    'change_plan',
                    'change_subscription_status',
                    'set_super_admin',
                    'revoke_super_admin'
                  )),
  old_value       JSONB,
  new_value       JSONB,
  reason          TEXT,
  ip_address      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fal_actor      ON public.feature_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_fal_target     ON public.feature_audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_fal_action     ON public.feature_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_fal_created_at ON public.feature_audit_logs(created_at DESC);

ALTER TABLE public.feature_audit_logs ENABLE ROW LEVEL SECURITY;
-- No user-facing RLS — all access via service-role key at API layer

-- ============================================================
-- 8. updated_at triggers (reuse existing function)
-- ============================================================
CREATE OR REPLACE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER trg_ufo_updated_at
  BEFORE UPDATE ON public.user_feature_overrides
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER trg_features_updated_at
  BEFORE UPDATE ON public.features
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
