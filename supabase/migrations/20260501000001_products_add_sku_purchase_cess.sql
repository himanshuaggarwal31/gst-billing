-- Add SKU, purchase_rate, and cess_rate to products master
-- Matches fields available in Zoho Books, Vyapar, QuickBooks India

alter table public.products
  add column if not exists sku text,
  add column if not exists purchase_rate numeric(12,2),
  add column if not exists cess_rate numeric(4,2) not null default 0;

comment on column public.products.sku           is 'Item code / SKU (optional, for internal reference)';
comment on column public.products.purchase_rate is 'Cost price / purchase rate (optional, for margin tracking)';
comment on column public.products.cess_rate     is 'Additional GST cess % (e.g. 1% on tobacco, 12% on aerated drinks)';
