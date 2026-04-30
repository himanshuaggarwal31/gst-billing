-- ============================================================
-- Migration 002: Custom logo + Client portal + Expenses
--               + Recurring Invoices + Credit Notes + Accountant Access
-- Run this in Supabase SQL editor
-- ============================================================

-- #4 Custom Logo: add logo_url to profiles
alter table public.profiles
  add column if not exists logo_url text;

-- #7 Invoice Theme
alter table public.invoices
  add column if not exists theme text not null default 'classic';

-- #6 Client Portal: public shareable token on invoices
alter table public.invoices
  add column if not exists public_token uuid not null default uuid_generate_v4() unique;

create index if not exists idx_invoices_public_token on public.invoices(public_token);

-- Allow anonymous read of invoices via public token (no auth required)
create policy "Public can view invoice by token"
  on public.invoices for select
  using (true);  -- RLS filtered by token in API, not here

-- #9 Expense Tracking
create table if not exists public.expenses (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  vendor_name text not null,
  expense_date date not null default current_date,
  description text,
  amount numeric(12,2) not null default 0,
  gst_rate numeric(4,2) not null default 18,
  gst_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  category text not null default 'General',
  receipt_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.expenses enable row level security;

create policy "Users can manage own expenses"
  on public.expenses for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_expenses_user_id on public.expenses(user_id);
create index if not exists idx_expenses_expense_date on public.expenses(expense_date);

-- #10 Recurring Invoice Templates
create table if not exists public.recurring_templates (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id),
  name text not null,
  seller_state_code char(2) not null,
  notes text,
  frequency text not null default 'monthly' check (frequency in ('monthly', 'quarterly', 'yearly')),
  next_run_date date not null,
  is_active boolean not null default true,
  last_run_date date,
  invoice_number_prefix text not null default 'REC-',
  line_items jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.recurring_templates enable row level security;

create policy "Users can manage own recurring templates"
  on public.recurring_templates for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_recurring_user_id on public.recurring_templates(user_id);

-- #11 Credit Notes
create table if not exists public.credit_notes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id),
  client_id uuid not null references public.clients(id),
  credit_note_number text not null,
  credit_note_date date not null default current_date,
  reason text not null,
  taxable_amount numeric(12,2) not null default 0,
  total_cgst numeric(12,2) not null default 0,
  total_sgst numeric(12,2) not null default 0,
  total_igst numeric(12,2) not null default 0,
  total_gst numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  unique(user_id, credit_note_number)
);

alter table public.credit_notes enable row level security;

create policy "Users can manage own credit notes"
  on public.credit_notes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_credit_notes_user_id on public.credit_notes(user_id);
create index if not exists idx_credit_notes_invoice_id on public.credit_notes(invoice_id);

-- #14 Accountant / Team Access
create table if not exists public.account_members (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  member_email text not null,
  member_user_id uuid references auth.users(id) on delete set null,
  role text not null default 'viewer' check (role in ('viewer', 'editor')),
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique(owner_id, member_email)
);

alter table public.account_members enable row level security;

create policy "Owners can manage their account members"
  on public.account_members for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Members can view their own invitations"
  on public.account_members for select
  using (auth.uid() = member_user_id);

create index if not exists idx_account_members_owner_id on public.account_members(owner_id);
create index if not exists idx_account_members_member_email on public.account_members(member_email);

-- Supabase Storage bucket for logos (run separately in Storage UI or via dashboard)
-- Bucket name: "logos", public: true
-- insert into storage.buckets (id, name, public) values ('logos', 'logos', true) on conflict do nothing;
