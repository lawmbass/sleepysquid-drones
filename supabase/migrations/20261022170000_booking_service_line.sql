-- Business line for each booking: drones, ai, web.
-- bookings.service already holds the drone service type, so this is service_line.
-- NOT applied yet: ships with the merge of the client-hub PR. The app treats a
-- missing column as 'drones'.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS service_line text;

UPDATE public.bookings SET service_line = 'drones' WHERE service_line IS NULL;

ALTER TABLE public.bookings
  ALTER COLUMN service_line SET DEFAULT 'drones',
  ALTER COLUMN service_line SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_service_line_check') THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_service_line_check
      CHECK (service_line IN ('drones', 'ai', 'web'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS bookings_service_line_idx ON public.bookings (service_line);
