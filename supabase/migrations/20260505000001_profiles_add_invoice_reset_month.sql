-- Add a column to track which month the invoice counter was last reset.
-- This enables a lazy monthly reset: on the next invoice creation after a new
-- month starts, the counter is reset to 1 automatically without any cron job.
alter table public.profiles
  add column if not exists invoice_count_reset_month text;
