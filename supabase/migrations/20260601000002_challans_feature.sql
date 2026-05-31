-- ============================================================
-- Register 'challans' feature in the features table
-- so it can be enabled per plan / user via the admin panel
-- ============================================================

INSERT INTO public.features (id, name, description)
VALUES (
  'challans',
  'Delivery Challans',
  'Create and manage delivery challans for goods movement between locations (warehouse ↔ project sites)'
)
ON CONFLICT (id) DO NOTHING;
