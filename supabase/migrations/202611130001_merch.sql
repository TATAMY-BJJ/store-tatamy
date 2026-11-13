BEGIN;
ALTER TABLE public.items
  ADD COLUMN price numeric(12,2) CHECK (price >= 0 AND price <> 'NaN'::numeric),
  ADD COLUMN photos text[] NOT NULL DEFAULT '{}',
  ADD COLUMN import_key text UNIQUE,
  ADD COLUMN source_data jsonb;
COMMENT ON COLUMN public.items.source_data IS 'Original import record; never used as live stock.';
NOTIFY pgrst, 'reload schema';
COMMIT;
