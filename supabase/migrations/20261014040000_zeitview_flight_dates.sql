-- Flight windows for the six completed Zeitview missions imported on
-- 2026-10-11. Those rows have null due_window_start, due_window_end,
-- deadline, and bot_accepted_at, so the dashboard was using the import
-- time as the event date.
--
-- Each window is the start and end from the pilots@dronebase.com
-- confirmation (La Plata uses the later reschedule confirmation).
-- bot_accepted_at stays null: these are completed-mission backfill rows.
-- A row that already has due_window_start is left alone.

UPDATE public.mission_listings AS listing
SET
  due_window_start = flight.start_at,
  due_window_end = flight.end_at
FROM (
  VALUES
    ('DBM9380917324', timestamptz '2024-01-25 19:30:00+00', timestamptz '2024-01-25 20:30:00+00'),
    ('DBM5272171280', timestamptz '2024-08-28 19:00:00+00', timestamptz '2024-08-28 20:00:00+00'),
    ('DBM8900777480', timestamptz '2024-09-12 14:30:00+00', timestamptz '2024-09-12 15:30:00+00'),
    ('DBM0284367500', timestamptz '2024-10-31 16:30:00+00', timestamptz '2024-10-31 17:30:00+00'),
    ('DBM6932649899', timestamptz '2025-02-24 17:30:00+00', timestamptz '2025-02-24 18:30:00+00'),
    ('DBM5171408909', timestamptz '2025-05-27 18:30:00+00', timestamptz '2025-05-27 19:30:00+00')
) AS flight(external_mission_id, start_at, end_at)
WHERE listing.source = 'zeitview'
  AND listing.external_mission_id = flight.external_mission_id
  AND listing.due_window_start IS NULL;
