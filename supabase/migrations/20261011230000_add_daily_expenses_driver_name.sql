-- Free-typed driver on fuel expenses, used for per-driver fuel consumption analysis.
alter table public.daily_expenses add column if not exists driver_name text;
