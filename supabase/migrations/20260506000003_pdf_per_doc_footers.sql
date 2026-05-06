-- Per-document-type footer text overrides
-- Each column overrides the global pdf_footer_text for that specific document type.
-- When NULL the PDF falls back to pdf_footer_text, then to the built-in default.
alter table public.profiles
  add column if not exists pdf_footer_text_invoice    text,
  add column if not exists pdf_footer_text_quotation  text,
  add column if not exists pdf_footer_text_ewb        text;
