-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES
-- One profile per authenticated user, linked to auth.users
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  business_name text not null default '',
  gstin text,
  address text,
  city text,
  state_code char(2),
  pincode char(6),
  email text not null,
  phone text,
  pan text,
  plan text not null default 'free' check (plan in ('free', 'starter', 'pro', 'ca')),
  invoice_count_this_month int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);


-- ============================================================
-- CLIENTS
-- Customers that a user bills to
-- ============================================================
create table if not exists public.clients (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  gstin text,
  email text,
  phone text,
  address text not null default '',
  city text,
  state_code char(2) not null,
  pincode char(6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.clients enable row level security;

create policy "Users can manage own clients"
  on public.clients for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_clients_user_id on public.clients(user_id);


-- ============================================================
-- PRODUCTS / SERVICES (master)
-- ============================================================
create table if not exists public.products (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  hsn_sac_code text not null,
  is_service boolean not null default false,
  default_rate numeric(12,2) not null default 0,
  default_gst_rate numeric(4,2) not null default 18,
  unit text not null default 'Nos',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products enable row level security;

create policy "Users can manage own products"
  on public.products for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_products_user_id on public.products(user_id);


-- ============================================================
-- INVOICES
-- ============================================================
create table if not exists public.invoices (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id),
  invoice_number text not null,
  invoice_date date not null default current_date,
  due_date date,
  seller_state_code char(2) not null,
  buyer_state_code char(2) not null,
  is_inter_state boolean not null generated always as (seller_state_code <> buyer_state_code) stored,
  taxable_amount numeric(12,2) not null default 0,
  total_cgst numeric(12,2) not null default 0,
  total_sgst numeric(12,2) not null default 0,
  total_igst numeric(12,2) not null default 0,
  total_gst numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'partial')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, invoice_number)
);

alter table public.invoices enable row level security;

create policy "Users can manage own invoices"
  on public.invoices for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_invoices_user_id on public.invoices(user_id);
create index idx_invoices_client_id on public.invoices(client_id);
create index idx_invoices_payment_status on public.invoices(payment_status);


-- ============================================================
-- INVOICE LINE ITEMS
-- ============================================================
create table if not exists public.invoice_line_items (
  id uuid primary key default uuid_generate_v4(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  hsn_sac_code text not null,
  quantity numeric(12,3) not null,
  rate numeric(12,2) not null,
  discount_percent numeric(5,2) not null default 0,
  gst_rate numeric(4,2) not null,
  taxable_amount numeric(12,2) not null,
  cgst numeric(12,2) not null default 0,
  sgst numeric(12,2) not null default 0,
  igst numeric(12,2) not null default 0,
  total_gst numeric(12,2) not null,
  line_total numeric(12,2) not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.invoice_line_items enable row level security;

create policy "Users can manage own invoice line items"
  on public.invoice_line_items for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_line_items_invoice_id on public.invoice_line_items(invoice_id);
create index idx_line_items_user_id on public.invoice_line_items(user_id);


-- ============================================================
-- AUTO-UPDATE updated_at trigger
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at_profiles
  before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger set_updated_at_clients
  before update on public.clients
  for each row execute function public.handle_updated_at();

create trigger set_updated_at_products
  before update on public.products
  for each row execute function public.handle_updated_at();

create trigger set_updated_at_invoices
  before update on public.invoices
  for each row execute function public.handle_updated_at();


-- ============================================================
-- AUTO-CREATE PROFILE on first login
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
