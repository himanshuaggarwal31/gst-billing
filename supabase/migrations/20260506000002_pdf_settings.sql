-- PDF preferences on profiles
-- pdf_theme:               default PDF theme for new invoices/quotations ('classic' | 'minimal' | 'modern')
-- pdf_accent_color:        custom hex accent colour overriding the theme's default
-- pdf_footer_text:         custom text shown in the PDF footer (replaces "computer-generated" default)
-- pdf_terms:               multi-line Terms & Conditions block printed below Notes
-- pdf_show_amount_in_words: when true, the grand total is also shown as "Rs. X Rupees Y Paise Only"
-- pdf_print_copies:        when true, the PDF contains two pages — Original for Recipient + Duplicate for Supplier

alter table public.profiles
  add column if not exists pdf_theme            text        not null default 'classic'
                                                check (pdf_theme in ('classic', 'minimal', 'modern')),
  add column if not exists pdf_accent_color     text,
  add column if not exists pdf_footer_text      text,
  add column if not exists pdf_terms            text,
  add column if not exists pdf_show_amount_in_words boolean not null default false,
  add column if not exists pdf_print_copies     boolean not null default false;
