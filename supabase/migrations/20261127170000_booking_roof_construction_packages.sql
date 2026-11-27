-- Allow roof and construction packages.
-- Older basic/standard/premium rows and the listing, event, and mapping packages stay valid.

ALTER TABLE public.bookings DROP CONSTRAINT bookings_package_check;

ALTER TABLE public.bookings ADD CONSTRAINT bookings_package_check CHECK (
  package IS NULL OR package IN (
    'basic',
    'standard',
    'premium',
    'listing-photos',
    'listing-video',
    'event-aerials',
    'mapping-3d',
    'roof-property-condition',
    'construction-single-visit',
    'construction-monthly-2',
    'construction-monthly-4'
  )
);
