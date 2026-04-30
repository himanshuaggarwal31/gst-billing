-- ============================================================
-- Migration 004: Quotations / Proforma Invoices
-- Run this in Supabase SQL editor
-- ============================================================

create table if not exists public.quotations (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  client_id       uuid not null references public.clients(id),
  quote_number    text not null,
  quote_date      date not null default current_date,
  valid_until     date,
  seller_state_code char(2) not null,
  status          text not null default 'draft'
                  check (status in ('draft', 'sent', 'accepted', 'rejected', 'expired', 'converted')),
  notes           text,
  theme           text not null default 'classic',
  taxable_amount  numeric(12,2) not null default 0,
  total_cgst      numeric(12,2) not null default 0,
  total_sgst      numeric(12,2) not null default 0,
  total_igst      numeric(12,2) not null default 0,
  total_gst       numeric(12,2) not null default 0,
  total_amount    numeric(12,2) not null default 0,
  -- if converted to invoice, link is stored here
  converted_invoice_id uuid references public.invoices(id) on delete set null,
  created_by_email text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique(user_id, quote_number)
);

alter table public.quotations enable row level security;

create policy "Users can manage own quotations"
  on public.quotations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_quotations_user_id on public.quotations(user_id);
create index if not exists idx_quotations_client_id on public.quotations(client_id);
create index if not exists idx_quotations_status on public.quotations(status);

-- Line items (reuses same structure as invoice_line_items)
create table if not exists public.quotation_line_items (
  id              uuid primary key default uuid_generate_v4(),
  quotation_id    uuid not null references public.quotations(id) on delete cascade,
  description     text not null,
  hsn_sac_code    text not null default '',
  quantity        numeric(10,3) not null default 1,
  rate            numeric(12,2) not null default 0,
  gst_rate        numeric(4,2) not null default 18,
  discount_percent numeric(4,2) not null default 0,
  taxable_amount  numeric(12,2) not null default 0,
  gst_amount      numeric(12,2) not null default 0,
  total_amount    numeric(12,2) not null default 0,
  sort_order      int not null default 0
);

alter table public.quotation_line_items enable row level security;

create policy "Users can manage own quotation line items"
  on public.quotation_line_items for all
  using (
    exists (
      select 1 from public.quotations q
      where q.id = quotation_id and q.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.quotations q
      where q.id = quotation_id and q.user_id = auth.uid()
    )
  );

create index if not exists idx_quote_line_items_quotation_id on public.quotation_line_items(quotation_id);
