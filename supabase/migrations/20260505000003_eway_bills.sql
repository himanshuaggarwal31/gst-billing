-- e-Way Bill records linked to invoices.
-- One e-Way Bill per invoice (unique constraint on invoice_id).
-- Transport details are filled before downloading the NIC JSON.
-- The eway_bill_number + valid_until are entered after uploading to the portal.

create table if not exists public.eway_bills (
  id               uuid        primary key default gen_random_uuid(),
  invoice_id       uuid        not null unique references public.invoices(id) on delete cascade,
  user_id          uuid        not null references auth.users(id),

  -- Supply
  supply_type      text        not null default 'O',   -- O=Outward, I=Inward
  sub_supply_type  int         not null default 1,     -- 1=Supply, 3=Export, 4=Job Work, etc.

  -- Transport
  transport_mode   text        not null default '1',   -- 1=Road, 2=Rail, 3=Air, 4=Ship
  distance_km      int         not null default 0,
  transporter_name text,
  transporter_id   text,                               -- Transporter GSTIN (optional)

  -- Vehicle (Road mode)
  vehicle_no       text,                               -- e.g. UP14AB1234
  vehicle_type     text        not null default 'R',   -- R=Regular, O=Over Dimensional Cargo

  -- Transport document (Rail/Air/Ship)
  trans_doc_no     text,                               -- LR / RR / AWB number
  trans_doc_date   date,

  -- Filled in after uploading JSON to ewaybillgst.gov.in
  eway_bill_number text,
  valid_until      date,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.eway_bills enable row level security;

create policy "Users manage their own e-Way Bills"
  on public.eway_bills for all
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

create index idx_eway_bills_invoice_id on public.eway_bills(invoice_id);
create index idx_eway_bills_user_id    on public.eway_bills(user_id);
