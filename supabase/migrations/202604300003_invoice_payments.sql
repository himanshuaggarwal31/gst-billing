-- invoice_payments table for tracking multiple payment transactions per invoice
-- Run this in Supabase SQL editor

create table if not exists public.invoice_payments (
  id           uuid primary key default gen_random_uuid(),
  invoice_id   uuid not null references public.invoices(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  amount       numeric(12, 2) not null,
  payment_date date not null,
  method       text not null default 'bank_transfer'
               check (method in ('bank_transfer', 'upi', 'cheque', 'cash', 'card', 'other')),
  reference_number text,
  notes        text,
  recorded_by_email text,
  created_at   timestamptz not null default now()
);

-- Enable RLS
alter table public.invoice_payments enable row level security;

-- Policy: owners and their delegates can see/manage payments
create policy "invoice_payments_owner_access" on public.invoice_payments
  using (user_id = auth.uid());

-- Index for fast lookups per invoice
create index if not exists invoice_payments_invoice_id_idx on public.invoice_payments(invoice_id);
create index if not exists invoice_payments_user_id_idx on public.invoice_payments(user_id);
