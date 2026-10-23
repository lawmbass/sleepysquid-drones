-- Pending admin bookings can be saved before the address is known.
-- Not applied automatically: run against prod before deploying the code.
ALTER TABLE public.bookings ALTER COLUMN location DROP NOT NULL;
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_location_length;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_location_length
  CHECK (location IS NULL OR char_length(location) BETWEEN 1 AND 200);
