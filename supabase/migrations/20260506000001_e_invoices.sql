-- E-Invoice records linked to invoices.
-- One e-Invoice per invoice (unique constraint on invoice_id).
-- Workflow: generate JSON → upload to IRP portal → paste IRN/ACK/QR back here.

create table if not exists public.e_invoices (
  id               uuid        primary key default gen_random_uuid(),
  invoice_id       uuid        not null unique references public.invoices(id) on delete cascade,
  user_id          uuid        not null references auth.users(id),

  -- Filled in after IRP portal accepts the upload
  irn              text,                          -- 64-char Invoice Reference Number
  ack_no           text,                          -- Acknowledgement number (NIC)
  ack_date         text,                          -- Acknowledgement date (YYYY-MM-DD)
  signed_qr        text,                          -- SignedQRCode string from IRP (rendered as QR on invoice)

  status           text        not null default 'pending'
                               check (status in ('pending', 'generated', 'cancelled')),

  -- Cancellation details (if cancelled on IRP)
  cancel_irn_hash  text,
  cancel_date      text,
  cancel_remark    text,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.e_invoices enable row level security;

create policy "Users manage their own e-Invoices"
  on public.e_invoices for all
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

create index idx_e_invoices_invoice_id on public.e_invoices(invoice_id);
create index idx_e_invoices_user_id    on public.e_invoices(user_id);
