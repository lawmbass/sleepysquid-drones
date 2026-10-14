/**
 * Flight windows for the six completed Zeitview missions imported on
 * 2026-10-11 with null due_window_start, due_window_end, deadline, and
 * bot_accepted_at. Each window is the start and end from the
 * pilots@dronebase.com confirmation. La Plata uses the later reschedule
 * confirmation. These are not accept times, so bot_accepted_at stays null.
 */
export const ZEITVIEW_FLIGHT_WINDOWS = {
  DBM9380917324: {
    start: "2024-01-25T19:30:00.000Z",
    end: "2024-01-25T20:30:00.000Z",
  },
  DBM5272171280: {
    start: "2024-08-28T19:00:00.000Z",
    end: "2024-08-28T20:00:00.000Z",
  },
  DBM8900777480: {
    start: "2024-09-12T14:30:00.000Z",
    end: "2024-09-12T15:30:00.000Z",
  },
  DBM0284367500: {
    start: "2024-10-31T16:30:00.000Z",
    end: "2024-10-31T17:30:00.000Z",
  },
  DBM6932649899: {
    start: "2025-02-24T17:30:00.000Z",
    end: "2025-02-24T18:30:00.000Z",
  },
  DBM5171408909: {
    start: "2025-05-27T18:30:00.000Z",
    end: "2025-05-27T19:30:00.000Z",
  },
};

export function knownZeitviewFlight(externalMissionId) {
  if (!externalMissionId) return null;
  return ZEITVIEW_FLIGHT_WINDOWS[externalMissionId] || null;
}
