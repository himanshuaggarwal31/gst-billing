-- ============================================================
-- Migration: Delivery Challans System
-- Supports goods movement tracking:
--   warehouse → project, project → project, project → warehouse
-- Three challan types: delivery, job_work, return
-- Returnable / non-returnable flag
-- Status flow: draft → dispatched → received → returned
-- ============================================================

-- ============================================================
-- 1. Locations table (user-defined warehouses / project sites)
-- ============================================================
create table if not exists public.locations (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  type        text not null default 'warehouse'
              check (type in ('warehouse', 'project_site', 'other')),
  address     text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(user_id, name)
);

alter table public.locations enable row level security;

create policy "Users can manage own locations"
  on public.locations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_locations_user_id on public.locations(user_id);
create index if not exists idx_locations_type on public.locations(type);

-- ============================================================
-- 2. Challans table
-- ============================================================
create table if not exists public.challans (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references auth.users(id) on delete cascade,

  challan_number    text not null,
  challan_date      date not null default current_date,
  challan_type      text not null default 'delivery'
                    check (challan_type in ('delivery', 'job_work', 'return')),
  returnable_type   text not null default 'non_returnable'
                    check (returnable_type in ('returnable', 'non_returnable')),
  status            text not null default 'draft'
                    check (status in ('draft', 'dispatched', 'received', 'returned')),

  -- movement from → to
  from_location_id  uuid references public.locations(id) on delete set null,
  to_location_id    uuid references public.locations(id) on delete set null,
  from_location_name text,   -- snapshot at creation time (in case location is deleted)
  to_location_name  text,

  -- optional link to client (for job-work sent to vendor, etc.)
  client_id         uuid references public.clients(id) on delete set null,

  -- transport details
  vehicle_number    text,
  driver_name       text,
  transporter_name  text,

  -- dispatch / receipt timestamps
  dispatched_at     timestamptz,
  received_at       timestamptz,
  returned_at       timestamptz,

  notes             text,
  created_by_email  text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique(user_id, challan_number)
);

alter table public.challans enable row level security;

create policy "Users can manage own challans"
  on public.challans for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_challans_user_id on public.challans(user_id);
create index if not exists idx_challans_status on public.challans(status);
create index if not exists idx_challans_client_id on public.challans(client_id);
create index if not exists idx_challans_from_location on public.challans(from_location_id);
create index if not exists idx_challans_to_location on public.challans(to_location_id);
create index if not exists idx_challans_date on public.challans(challan_date);

-- ============================================================
-- 3. Challan items table
-- Note: no GST amounts — challan is a movement doc, not a sale
-- ============================================================
create table if not exists public.challan_items (
  id            uuid primary key default uuid_generate_v4(),
  challan_id    uuid not null references public.challans(id) on delete cascade,
  product_id    uuid references public.products(id) on delete set null,
  description   text not null,
  hsn_sac_code  text not null default '',
  quantity      numeric(12,3) not null default 1,
  unit          text not null default 'nos'
                check (unit in ('nos', 'pcs', 'kg', 'mtr', 'rmt', 'set', 'box', 'ltr', 'sqm', 'sqft', 'ton', 'other')),
  remarks       text,
  sort_order    int not null default 0
);

alter table public.challan_items enable row level security;

create policy "Users can manage own challan items"
  on public.challan_items for all
  using (
    exists (
      select 1 from public.challans c
      where c.id = challan_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.challans c
      where c.id = challan_id and c.user_id = auth.uid()
    )
  );

create index if not exists idx_challan_items_challan_id on public.challan_items(challan_id);
create index if not exists idx_challan_items_product_id on public.challan_items(product_id);

-- ============================================================
-- 4. Add challan number prefix to profiles
-- ============================================================
alter table public.profiles
  add column if not exists challan_prefix text not null default 'DCH-';
