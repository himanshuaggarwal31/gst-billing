-- Add configurable PDF print copy labels to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pdf_copy_labels JSONB DEFAULT NULL;

COMMENT ON COLUMN public.profiles.pdf_copy_labels IS
  'Ordered array of copy labels for multi-copy PDF printing, e.g. ["ORIGINAL FOR RECIPIENT","DUPLICATE FOR SUPPLIER"]. NULL = single page, no label.';
