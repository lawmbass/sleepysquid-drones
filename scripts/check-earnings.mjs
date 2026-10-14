import assert from "node:assert/strict";

const { selectUnlinkedEarnings, unlinkedPayoutTotal } = await import("../libs/earnings.js");
const { mergeJobs, summarizeJobs, summarizeAnalytics, listingToJob, listingSchedule, gigCardState, missionDetailAmounts, analyticsDateRange, selectAnalyticsJobs, overviewGigStatus, overviewStatusCounts, filterOverviewJobs, openGigsLabel } = await import("../libs/jobs.js");
const { buildCancelDraft, cancelGigVisibility, gmailComposeUrl, mailtoUrl, flightWarning } = await import("../libs/cancelGig.js");
const { adminConfig } = await import("../libs/adminConfig.js");
const { ZEITVIEW_FLIGHT_WINDOWS } = await import("../libs/zeitviewFlights.js");

const linked = {
  status: "accepted",
  bookingId: "11111111-1111-1111-1111-111111111111",
  payout: 400,
  source: "zeitview",
};
const open = {
  status: "accepted",
  bookingId: null,
  payout: 250,
  source: "zeitview",
  deadline: "2026-01-15T00:00:00.000Z",
  travelDistance: 12,
};
const declined = {
  status: "declined_by_filter",
  bookingId: null,
  payout: 900,
  source: "zeitview",
};
const undated = {
  status: "accepted",
  bookingId: null,
  payout: 80,
  source: "zeitview",
};

const listings = [linked, open, declined, undated];

assert.equal(unlinkedPayoutTotal(listings), 330);
assert.equal(selectUnlinkedEarnings(listings).length, 2);
assert.equal(selectUnlinkedEarnings(listings)[0].status, "completed");
assert.equal(selectUnlinkedEarnings(listings, { status: "confirmed" }).length, 0);
assert.equal(selectUnlinkedEarnings(listings, { status: "completed" }).length, 2);
assert.equal(
  selectUnlinkedEarnings(listings, { dateFrom: "2026-01-01T00:00:00.000Z", dateTo: "2026-01-31T00:00:00.000Z" }).length,
  1
);
assert.equal(selectUnlinkedEarnings(listings, { source: "manual" }).length, 0);

const booking = {
  id: "booking-1",
  source: "zeitview",
  status: "confirmed",
  payout: 400,
  service: "inspection",
  date: "2026-02-01T00:00:00.000Z",
  location: "Linked site",
  name: "Linked gig",
};
const linkedListing = {
  id: "listing-linked",
  status: "accepted",
  bookingId: "booking-1",
  payout: 400,
  source: "zeitview",
  missionType: "roof",
};
const openListing = {
  id: "listing-open",
  status: "accepted",
  bookingId: null,
  payout: 250,
  source: "zeitview",
  missionType: "thermal",
  clientName: "Acme",
  address: "1 Main St",
  title: "Thermal roof",
  deadline: "2026-01-15T00:00:00.000Z",
  travelDistance: 12,
};
const customer = {
  id: "booking-2",
  source: "customer",
  status: "pending",
  estimatedPrice: 100,
  service: "real-estate",
  date: "2026-06-01T00:00:00.000Z",
  location: "Customer site",
  name: "Customer",
};

const jobs = mergeJobs([booking, customer], [linkedListing, openListing, declined]);
const summary = summarizeJobs(jobs, { now: new Date("2026-03-01T00:00:00.000Z") });
assert.equal(summary.totalJobs, 3);
assert.equal(summary.totalRevenue, 750);
assert.equal(summary.stats.completed.count, 1);
assert.equal(summary.stats.completed.totalValue, 250);
assert.equal(summary.stats.confirmed.count, 1);
assert.equal(summary.customerBookings, 1);
assert.equal(summary.missionStats.totalMissions, 2);
assert.equal(summary.missionStats.totalPayout, 650);
assert.equal(summary.upcomingCount, 1);
assert.equal(summary.recentJobs[0].id, "booking-2");
assert.equal(summary.recentJobs.length, summary.totalJobs);

const laPlata = listingToJob({
  id: "la-plata",
  status: "accepted",
  source: "zeitview",
  payout: 150,
  address: "La Plata",
  title: "La Plata",
  externalMissionId: "DBM5272171280",
  lastSeenAt: "2026-10-11T23:00:00.000Z",
  rawDetail: { schedule: { flight_date_and_time: "08/28/2024 3:00 PM" } },
});
assert.equal(laPlata.date, "2024-08-28T15:00:00.000Z");
assert.equal(laPlata.hasFlightTime, true);
assert.equal(laPlata.wallClock, true);
assert.equal(laPlata.scheduleSource, "raw_detail");

const deale = listingToJob({
  id: "deale",
  lastSeenAt: "2026-10-11T23:00:00.000Z",
  deadline: "2026-10-11T23:00:00.000Z",
  rawDetail: { parsed: { schedule: "09/12/2024 10:30 AM" } },
});
assert.equal(deale.date, "2024-09-12T10:30:00.000Z");
assert.equal(deale.hasFlightTime, true);

const centreville = listingToJob({
  id: "centreville",
  lastSeenAt: "2026-10-11T23:00:00.000Z",
  rawDetail: {
    page: "<section>Schedule</section><div>Flight date and time</div><div>05/27/2025 2:30 PM</div>",
  },
});
assert.equal(centreville.date, "2025-05-27T14:30:00.000Z");

const pageHtml = `<div class="mission-scheduling">…<div class="mission-date">05/27/2025</div><div class="mission-time">02:30PM</div>`;
const fromHtml = listingToJob({
  id: "centreville-html",
  lastSeenAt: "2026-10-11T23:00:00.000Z",
  deadline: "2026-10-11T23:00:00.000Z",
  rawDetail: { html: pageHtml, title: "No schedule key" },
});
assert.equal(fromHtml.date, "2025-05-27T18:30:00.000Z");
assert.equal(fromHtml.hasFlightTime, true);
assert.equal(fromHtml.wallClock, false);
assert.equal(fromHtml.scheduleSource, "page_html");

const pageText = "Download KML\n02/24/2025\n12:30PM\nYou must arrive on time on the scheduled flight date…";
const fromText = listingToJob({
  id: "february-text",
  lastSeenAt: "2026-10-11T23:00:00.000Z",
  rawDetail: { text: pageText },
});
assert.equal(fromText.date, "2025-02-24T17:30:00.000Z");
assert.equal(fromText.hasFlightTime, true);
assert.equal(fromText.scheduleSource, "page_text");

const preferred = listingToJob({
  id: "prefer-arrive",
  lastSeenAt: "2026-10-11T23:00:00.000Z",
  rawDetail: {
    text: "Download KML\n02/24/2025\n12:30PM\nNotes\n05/27/2025\n02:30PM\nYou must arrive on time on the scheduled flight date…",
  },
});
assert.equal(preferred.date, "2025-05-27T18:30:00.000Z");

const htmlBeatsText = listingToJob({
  id: "html-beats-text",
  rawDetail: {
    html: pageHtml,
    text: pageText,
  },
});
assert.equal(htmlBeatsText.date, "2025-05-27T18:30:00.000Z");
assert.equal(htmlBeatsText.scheduleSource, "page_html");

const scheduleBeatsPage = listingToJob({
  id: "schedule-wins",
  lastSeenAt: "2026-10-11T23:00:00.000Z",
  rawDetail: {
    schedule: { flight_date_and_time: "08/28/2024 3:00 PM" },
    html: pageHtml,
  },
});
assert.equal(scheduleBeatsPage.date, "2024-08-28T15:00:00.000Z");
assert.equal(scheduleBeatsPage.scheduleSource, "raw_detail");

const spacedTime = listingToJob({
  id: "spaced-time",
  lastSeenAt: "2026-10-11T23:00:00.000Z",
  rawDetail: { text: "Download KML\n05/27/2025\n02:30 PM\nYou must arrive on time on the scheduled flight date…" },
});
assert.equal(spacedTime.date, "2025-05-27T18:30:00.000Z");
assert.equal(spacedTime.hasFlightTime, true);
assert.equal(spacedTime.scheduleSource, "page_text");

const seenOnly = listingToJob({
  id: "seen-only",
  lastSeenAt: "2026-10-11T23:00:00.000Z",
  firstSeenAt: "2026-10-11T16:00:00.000Z",
  rawDetail: { title: "No schedule stored" },
});
assert.equal(seenOnly.date, null);
assert.equal(seenOnly.hasFlightTime, false);
assert.equal(seenOnly.scheduleSource, null);

const confirmation = listingToJob({
  id: "cobb-email",
  lastSeenAt: "2026-10-11T16:00:00.000Z",
  firstSeenAt: "2026-10-11T16:00:00.000Z",
  rawEmailText: "Your flight is scheduled for\nThursday, January 25, 2024\n 2:30PM EST - 3:30PM EST\n",
});
assert.equal(confirmation.date, "2024-01-25T19:30:00.000Z");
assert.equal(confirmation.hasFlightTime, true);
assert.equal(confirmation.wallClock, false);
assert.equal(confirmation.scheduleSource, "email");

const rescheduled = listingToJob({
  id: "la-plata-email",
  lastSeenAt: "2026-10-11T23:00:00.000Z",
  rawEmailText: [
    "Your flight is scheduled for",
    "Tuesday, August 27, 2024",
    "10:00AM EDT - 11:00AM EDT",
    "Your flight has been rescheduled for",
    "Wednesday, August 28, 2024",
    " 3:00PM EDT - 4:00PM EDT",
  ].join("\n"),
});
assert.equal(rescheduled.date, "2024-08-28T19:00:00.000Z");
assert.equal(rescheduled.scheduleSource, "email");

const windowed = listingToJob({
  id: "windowed",
  dueWindowStart: "2025-05-27T18:30:00.000Z",
  deadline: "2025-06-01T00:00:00.000Z",
  lastSeenAt: "2026-10-11T23:00:00.000Z",
});
assert.equal(windowed.scheduleSource, "due_window");
assert.equal(windowed.date, "2025-05-27T18:30:00.000Z");
assert.equal(windowed.hasFlightTime, true);
const thermal = jobs.find((job) => job.id === "listing-open");
assert.equal(thermal.service, "thermal");
assert.equal(thermal.location, "1 Main St");
assert.equal(thermal.status, "completed");
assert.equal(thermal.date, "2026-01-15T00:00:00.000Z");

const analytics = summarizeAnalytics(filterForJanuary(jobs));
assert.equal(analytics.summary.totalJobs, 1);
assert.equal(analytics.summary.totalRevenue, 250);
assert.equal(analytics.summary.completionRate, 100);
assert.equal(analytics.topServices[0].service, "thermal");
assert.equal(analytics.revenueByMonth[0].totalValue, 250);
assert.equal(analytics.sourceBreakdown.zeitview.count, 1);

function filterForJanuary(rows) {
  return rows.filter((job) => job.date && job.date.startsWith("2026-01"));
}

process.env.ADMIN_EMAILS = "Lawrence@SleepySquid.com, pilot@example.com";
adminConfig.reloadFromEnv();

assert.equal(adminConfig.isAdmin("lawrence@sleepysquid.com"), true);
assert.equal(adminConfig.isAdmin("other@sleepysquid.com"), true);
assert.equal(adminConfig.isAdmin("pilot@example.com"), true);
assert.equal(adminConfig.isAdmin("guest@example.com"), false);
assert.equal(adminConfig.isAdmin(""), false);

const pageListing = {
  rawDetail: {
    html: `<div class="mission-scheduling"><div class="mission-date">05/27/2025</div><div class="mission-time">02:30PM</div></div>`,
  },
};
const pageSchedule = listingSchedule(pageListing);
assert.equal(pageSchedule.date, "2025-05-27T18:30:00.000Z");
assert.equal(flightWarning(pageSchedule, new Date("2025-05-26T18:30:00.000Z")).level, "ok");
assert.equal(flightWarning(pageSchedule, new Date("2025-05-26T18:30:00.001Z")).level, "soon");
assert.equal(flightWarning(pageSchedule, new Date("2025-05-27T18:30:00.000Z")).level, "soon");
assert.equal(flightWarning(pageSchedule, new Date("2025-05-27T18:30:00.001Z")).level, "past");

const draft = buildCancelDraft({
  intent: "cancel",
  missionId: "DBM5272171280",
  address: "La Plata",
  schedule: pageSchedule,
  reason: "Weather",
});
assert.equal(draft.to, "pilots@dronebase.com");
assert.equal(draft.subject, "Cancel mission DBM5272171280 – La Plata");
assert.match(draft.body, /Mission: DBM5272171280/);
assert.match(draft.body, /Address: La Plata/);
assert.match(draft.body, /2:30 PM ET/);
assert.match(draft.body, /Reason: Weather/);
assert.match(draft.body, /Thanks, Lawrence Bass/);
const gmail = gmailComposeUrl(draft);
assert.ok(gmail.startsWith("https://mail.google.com/mail/?"));
assert.ok(gmail.includes("authuser=lawmbass1%40gmail.com"));
assert.ok(gmail.includes("view=cm"));
assert.ok(gmail.includes("fs=1"));
assert.ok(gmail.includes("to=pilots%40dronebase.com"));
assert.ok(gmail.includes(`su=${encodeURIComponent(draft.subject)}`));
assert.ok(gmail.includes(`body=${encodeURIComponent(draft.body)}`));
const mail = mailtoUrl(draft);
assert.ok(mail.startsWith("mailto:pilots@dronebase.com?"));
assert.ok(mail.includes(encodeURIComponent(draft.subject)));
const reschedule = buildCancelDraft({
  intent: "reschedule",
  missionId: "DBM1",
  address: "Deale",
  schedule: pageSchedule,
  reason: "Conflict",
});
assert.equal(reschedule.subject, "Reschedule mission DBM1 – Deale");

const kept = { id: "kept", status: "accepted", bookingId: null, payout: 50, source: "zeitview" };
const asked = {
  id: "asked",
  status: "accepted",
  bookingId: null,
  payout: 75,
  source: "zeitview",
  cancelStatus: "cancel_requested",
};
const dropped = {
  id: "dropped",
  status: "accepted",
  bookingId: null,
  payout: 999,
  source: "zeitview",
  cancelStatus: "cancelled",
};
const linkedBooking = {
  id: "booking-linked",
  source: "zeitview",
  status: "completed",
  payout: 400,
  service: "inspection",
  date: "2026-04-01T00:00:00.000Z",
  location: "Linked site",
  name: "Linked gig",
};
const cancelJobs = mergeJobs(
  [linkedBooking, customer],
  [kept, asked, dropped],
  [{ id: "flag-linked", bookingId: "booking-linked", cancelStatus: "cancelled" }]
);
assert.equal(cancelJobs.some((job) => job.id === "dropped"), false);
assert.equal(cancelJobs.some((job) => job.id === "booking-linked"), false);
assert.equal(cancelJobs.find((job) => job.id === "asked").cancelStatus, "cancel_requested");
const cancelSummary = summarizeJobs(cancelJobs, { now: new Date("2026-01-01T00:00:00.000Z") });
assert.equal(cancelSummary.totalRevenue, 225);
assert.equal(cancelSummary.totalJobs, 3);

const acceptedBooking = {
  id: "booking-open",
  status: "confirmed",
  acceptedAt: "2026-10-01T15:00:00.000Z",
};
const openGig = {
  id: "open-gig",
  status: "accepted",
  bookingId: "booking-open",
  botAcceptedAt: "2026-10-01T15:00:00.000Z",
  cancelStatus: null,
  source: "zeitview",
};
const pendingNow = new Date("2026-10-13T12:00:00.000Z");
assert.equal(cancelGigVisibility({ listing: { id: "bare", status: "accepted", bookingId: null } }).showCancel, false);
assert.equal(cancelGigVisibility({ listing: openGig, booking: acceptedBooking, now: pendingNow }).showCancel, true);
assert.equal(cancelGigVisibility({ listing: openGig, booking: acceptedBooking, now: pendingNow }).showUndo, false);
assert.equal(cancelGigVisibility({
  listing: openGig,
  booking: { ...acceptedBooking, status: "completed" },
  bookingStatus: "completed",
}).showCancel, false);
assert.equal(cancelGigVisibility({
  listing: { ...openGig, cancelStatus: "cancel_requested" },
  booking: { ...acceptedBooking, status: "completed" },
  bookingStatus: "completed",
}).showUndo, false);
assert.equal(cancelGigVisibility({
  listing: { ...openGig, botAcceptedAt: null },
  booking: { ...acceptedBooking, acceptedAt: null },
  now: pendingNow,
}).showCancel, false);
for (const status of ["completed", "flown", "uploaded"]) {
  assert.equal(cancelGigVisibility({
    listing: { ...openGig, status },
    booking: acceptedBooking,
  }).showCancel, false, status);
}
assert.equal(cancelGigVisibility({
  listing: { ...openGig, rawDetail: { backfill: "completed-mission" } },
  booking: acceptedBooking,
}).showCancel, false);
assert.equal(cancelGigVisibility({
  listing: { ...openGig, rawDetail: { parsed: { mission_status: "Assets uploaded" } } },
  booking: acceptedBooking,
}).showCancel, false);
assert.equal(cancelGigVisibility({
  listing: { ...openGig, rawDetail: { html: "upload assets when completed", status: "accepted" } },
  booking: acceptedBooking,
  now: pendingNow,
}).showCancel, true);
assert.equal(cancelGigVisibility({
  listing: { ...openGig, cancelStatus: "cancelled" },
  booking: acceptedBooking,
}).showCancel, false);
assert.equal(cancelGigVisibility({
  listing: { ...openGig, cancelStatus: "cancelled" },
  booking: acceptedBooking,
  now: pendingNow,
}).showUndo, true);
assert.equal(cancelGigVisibility({
  listing: { ...openGig, cancelStatus: "cancelled", rawDetail: { status: "flown" } },
  booking: acceptedBooking,
}).showUndo, false);
assert.equal(cancelGigVisibility({
  listing: { id: "unlinked-accepted", status: "accepted", bookingId: null },
  bookingStatus: "completed",
  unlinkedListing: true,
}).showCancel, false);

const cobbListing = {
  id: "cobb-listing",
  externalMissionId: "DBM9380917324",
  status: "accepted",
  bookingId: null,
  payout: 70,
  address: "Cobb Island",
  source: "zeitview",
  title: "Cobb Island",
  lastSeenAt: "2026-10-11T16:00:00.000Z",
};
const cobbJob = listingToJob(cobbListing);
assert.equal(cobbJob.missionId, "DBM9380917324");
assert.equal(cobbJob.payout, 70);
assert.equal(cobbJob.location, "Cobb Island");
assert.equal(cobbJob.unlinkedListing, true);
assert.equal(cobbJob.date, null);
assert.equal(cobbJob.hasFlightTime, false);
assert.equal(cobbJob.scheduleSource, null);
const cobbWindow = listingToJob({
  ...cobbListing,
  dueWindowStart: "2024-01-25T19:30:00.000Z",
  dueWindowEnd: "2024-01-25T20:30:00.000Z",
});
assert.equal(cobbWindow.date, "2024-01-25T19:30:00.000Z");
assert.equal(cobbWindow.hasFlightTime, true);
assert.equal(cobbWindow.scheduleSource, "due_window");
assert.deepEqual(Object.keys(ZEITVIEW_FLIGHT_WINDOWS).sort(), [
  "DBM0284367500",
  "DBM5171408909",
  "DBM5272171280",
  "DBM6932649899",
  "DBM8900777480",
  "DBM9380917324",
]);
assert.equal(ZEITVIEW_FLIGHT_WINDOWS.DBM9380917324.start, "2024-01-25T19:30:00.000Z");
assert.equal(ZEITVIEW_FLIGHT_WINDOWS.DBM5272171280.start, "2024-08-28T19:00:00.000Z");
assert.equal(ZEITVIEW_FLIGHT_WINDOWS.DBM8900777480.start, "2024-09-12T14:30:00.000Z");
assert.equal(ZEITVIEW_FLIGHT_WINDOWS.DBM0284367500.start, "2024-10-31T16:30:00.000Z");
assert.equal(ZEITVIEW_FLIGHT_WINDOWS.DBM6932649899.start, "2025-02-24T17:30:00.000Z");
assert.equal(ZEITVIEW_FLIGHT_WINDOWS.DBM5171408909.start, "2025-05-27T18:30:00.000Z");
assert.equal(cobbJob.status, "completed");
const cobbCard = gigCardState({ job: cobbJob, listing: cobbListing });
assert.equal(cobbCard.badgeStatus, "completed");
assert.equal(cobbCard.showCancel, false);
assert.equal(cobbCard.badgeStatus === "completed" && cobbCard.showCancel, false);

const backfill = { id: "backfill", status: "accepted", bookingId: null, payout: 80, source: "zeitview" };
const flownListing = { ...backfill, id: "flown-listing", rawDetail: { status: "flown" } };
assert.equal(cancelGigVisibility({ listing: backfill }).showCancel, false);
assert.equal(listingToJob(flownListing).workComplete, true);
assert.equal(listingToJob(flownListing).status, "completed");
assert.equal(mergeJobs([], [backfill, flownListing], []).length, 2);

assert.equal(cancelGigVisibility({
  listing: { ...openGig, rawDetail: { source: "completed-missions" } },
  booking: acceptedBooking,
}).showCancel, false);
assert.equal(cancelGigVisibility({
  listing: { ...openGig, rawDetail: { origin: "backfill-completed.js" } },
  booking: acceptedBooking,
}).showCancel, false);
assert.equal(cancelGigVisibility({
  listing: { ...openGig, rawDetail: { url: "https://pilot.dronebase.com/pilots/completed/DBM1" } },
  booking: acceptedBooking,
}).showCancel, false);
assert.equal(cancelGigVisibility({
  listing: { ...openGig, rawDetail: { source: "zeitview", url: "https://pilot.dronebase.com/missions/DBM1" } },
  booking: acceptedBooking,
  now: pendingNow,
}).showCancel, true);
assert.equal(cancelGigVisibility({
  listing: { ...openGig, rawDetail: { acceptResult: "bot" } },
  booking: { ...acceptedBooking, acceptedAt: null },
  now: pendingNow,
}).showCancel, true);
assert.equal(cancelGigVisibility({
  listing: { ...openGig, botAcceptedAt: null, rawDetail: { status: "incomplete" } },
  booking: { ...acceptedBooking, acceptedAt: null },
}).showCancel, false);

const pastPage = {
  ...openGig,
  rawDetail: {
    html: "<div class=\"mission-date\">05/27/2025</div><div class=\"mission-time\">02:30PM</div>",
  },
};
const pastSchedule = listingSchedule(pastPage);
assert.equal(pastSchedule.scheduleSource, "page_html");
assert.equal(pastSchedule.date, "2025-05-27T18:30:00.000Z");
const flightMs = new Date(pastSchedule.date).getTime();
const twelveHours = 12 * 60 * 60 * 1000;
assert.equal(cancelGigVisibility({
  listing: pastPage,
  booking: acceptedBooking,
  now: new Date(flightMs + twelveHours),
}).showCancel, true);
assert.equal(cancelGigVisibility({
  listing: pastPage,
  booking: acceptedBooking,
  now: new Date(flightMs + twelveHours + 1),
}).showCancel, false);
assert.equal(cancelGigVisibility({
  listing: { ...pastPage, cancelStatus: "cancel_requested" },
  booking: acceptedBooking,
  now: new Date(flightMs + twelveHours + 1),
}).showUndo, false);
assert.equal(cancelGigVisibility({
  listing: pastPage,
  booking: acceptedBooking,
  now: new Date("2025-05-26T18:30:00.000Z"),
}).showCancel, true);
assert.equal(cancelGigVisibility({
  listing: { ...openGig, lastSeenAt: "2020-01-01T00:00:00.000Z" },
  booking: acceptedBooking,
  now: new Date("2026-06-01T00:00:00.000Z"),
}).showCancel, true);
assert.equal(cancelGigVisibility({
  listing: { ...openGig, deadline: "2020-01-01T15:00:00.000Z" },
  booking: acceptedBooking,
  now: new Date("2026-06-01T00:00:00.000Z"),
}).showCancel, true);
assert.equal(cancelGigVisibility({
  listing: { ...openGig, dueWindowStart: "2020-01-01T15:00:00.000Z" },
  booking: acceptedBooking,
  now: new Date("2026-06-01T00:00:00.000Z"),
}).showCancel, true);
assert.equal(listingToJob(pastPage).workComplete, true);
assert.equal(gigCardState({ listing: pastPage, unlinkedListing: true }).showCancel, false);

const cobbIsland = listingToJob({
  id: "cobb",
  source: "zeitview",
  status: "accepted",
  payout: 70,
  externalMissionId: "DBM9380917324",
  address: "Cobb Island",
  title: "Cobb Island",
  bookingId: null,
});
const cobbAmounts = missionDetailAmounts(cobbIsland);
assert.equal(cobbIsland.unlinkedListing, true);
assert.equal(cobbIsland.readOnly, true);
assert.equal(cobbIsland.finalPrice, null);
assert.equal(cobbAmounts.payout, 70);
assert.equal(cobbAmounts.finalPrice, 70);
assert.equal(cobbAmounts.finalPriceFallsBack, true);

const laPlataAmounts = missionDetailAmounts(listingToJob({
  source: "zeitview",
  status: "accepted",
  payout: 150,
  externalMissionId: "DBM5272171280",
  bookingId: null,
}));
assert.equal(laPlataAmounts.payout, 150);
assert.equal(laPlataAmounts.finalPrice, 150);

const pricedMission = missionDetailAmounts({
  source: "zeitview",
  isMission: true,
  payout: 150,
  estimatedPrice: null,
  finalPrice: 180,
});
assert.equal(pricedMission.payout, 150);
assert.equal(pricedMission.finalPrice, 180);
assert.equal(pricedMission.finalPriceFallsBack, false);

const customerQuote = missionDetailAmounts({
  source: "customer",
  payout: null,
  estimatedPrice: 100,
  finalPrice: null,
});
assert.equal(customerQuote.payout, 100);
assert.equal(customerQuote.finalPrice, null);
assert.equal(customerQuote.finalPriceFallsBack, false);

const now = new Date("2026-10-14T12:00:00.000Z");
assert.equal(analyticsDateRange("all", now).dateFrom, null);
assert.equal(analyticsDateRange("30d", now).dateFrom, "2026-09-14T12:00:00.000Z");
assert.equal(analyticsDateRange("30d", now).dateTo, now.toISOString());

function flownGig(id, start, payout, miles) {
  return listingToJob({
    id,
    status: "accepted",
    bookingId: null,
    source: "zeitview",
    payout,
    travelDistance: miles,
    travelTime: miles * 2,
    dueWindowStart: start,
    lastSeenAt: "2026-10-11T16:00:00.000Z",
    firstSeenAt: "2026-10-11T16:00:00.000Z",
    externalMissionId: id,
  });
}
const pastFlights = [
  flownGig("DBM9380917324", "2024-01-25T19:30:00.000Z", 70, 10),
  flownGig("DBM5272171280", "2024-08-28T19:00:00.000Z", 150, 20),
  flownGig("DBM8900777480", "2024-09-12T14:30:00.000Z", 80, 15),
  flownGig("DBM0284367500", "2024-10-31T16:30:00.000Z", 70, 12),
  flownGig("DBM6932649899", "2025-02-24T17:30:00.000Z", 60, 8),
  flownGig("DBM5171408909", "2025-05-27T18:30:00.000Z", 70, 11),
];
const importOnly = listingToJob({
  id: "import-only",
  status: "accepted",
  bookingId: null,
  source: "zeitview",
  payout: 1000,
  travelDistance: 5,
  lastSeenAt: "2026-10-11T16:00:00.000Z",
  firstSeenAt: "2026-10-11T16:00:00.000Z",
});
assert.equal(importOnly.date, null);
const recent = flownGig("recent", "2026-10-01T15:00:00.000Z", 40, 4);
const analyticsJobs = [...pastFlights, importOnly, recent];

const lastMonth = selectAnalyticsJobs(analyticsJobs, { period: "30d", now });
assert.deepEqual(lastMonth.map((job) => job.id), ["recent"]);

const allTime = selectAnalyticsJobs(analyticsJobs, { period: "all", now });
assert.equal(allTime.some((job) => job.id === "import-only"), false);
assert.equal(allTime.length, 7);

const allPast = summarizeAnalytics(selectAnalyticsJobs(pastFlights, { period: "all", now }));
assert.equal(allPast.summary.totalMissions, 6);
assert.equal(allPast.summary.totalRevenue, 500);
assert.equal(allPast.summary.completionRate, 100);
assert.equal(allPast.summary.revenuePerMile, 6.58);
assert.equal(allPast.performanceMetrics.completedMissions, 6);
assert.equal(allPast.performanceMetrics.totalTravelDistance, 76);
assert.equal(allPast.performanceMetrics.totalTravelTime, 152);
assert.equal(allPast.performanceMetrics.maxPayout, 150);
assert.equal(allPast.performanceMetrics.minPayout, 60);
assert.equal(allPast.summary.statusCounts.completed, 6);
assert.equal(allPast.summary.customerBookings, 0);
assert.equal(allPast.summary.missionBookings, 6);
assert.equal(allPast.summary.avgMissionTravelDistance, 76 / 6);
assert.equal(allPast.summary.avgTravelDistance, 76 / 6);
const months = allPast.revenueByMonth.map((month) => `${month.year}-${month.month}`);
assert.deepEqual(months, ["2024-1", "2024-8", "2024-9", "2024-10", "2025-2", "2025-5"]);
assert.equal(months.includes("2026-10"), false);
assert.equal(summarizeAnalytics(lastMonth).summary.totalMissions, 1);

const customerDrive = {
  id: "customer-drive",
  source: "customer",
  isMission: false,
  status: "completed",
  date: "2026-10-02T15:00:00.000Z",
  travelDistance: 100,
  payout: 200,
};
const noDistance = listingToJob({
  id: "no-distance",
  status: "accepted",
  bookingId: null,
  source: "zeitview",
  payout: 25,
  travelDistance: null,
  dueWindowStart: "2024-06-01T15:00:00.000Z",
});
const zeroMile = listingToJob({
  id: "zero-mile",
  status: "accepted",
  bookingId: null,
  source: "zeitview",
  payout: 10,
  travelDistance: 0,
  dueWindowStart: "2024-03-01T15:00:00.000Z",
});
const zeroOnly = summarizeAnalytics([zeroMile, noDistance]);
assert.equal(zeroOnly.summary.missionBookings, 2);
assert.equal(zeroOnly.summary.customerBookings, 0);
assert.equal(zeroOnly.summary.avgMissionTravelDistance, 0);

const mixedJobs = [...pastFlights, recent, customerDrive, noDistance];
const mixedMonth = summarizeAnalytics(selectAnalyticsJobs(mixedJobs, { period: "30d", now }));
assert.equal(mixedMonth.summary.customerBookings, 1);
assert.equal(mixedMonth.summary.missionBookings, 1);
assert.equal(mixedMonth.summary.avgMissionTravelDistance, 4);
assert.equal(mixedMonth.summary.avgTravelDistance, 52);
const mixedAll = summarizeAnalytics(selectAnalyticsJobs(mixedJobs, { period: "all", now }));
assert.equal(mixedAll.summary.customerBookings, 1);
assert.equal(mixedAll.summary.missionBookings, 8);
assert.equal(mixedAll.summary.avgMissionTravelDistance, (76 + 4) / 7);
assert.equal(mixedAll.summary.avgTravelDistance, (76 + 4 + 100) / 8);

const overviewJobs = [
  { id: "p", status: "pending", unlinkedListing: false },
  { id: "c", status: "confirmed", unlinkedListing: false },
  { id: "i", status: "in-progress", unlinkedListing: false },
  { id: "d", status: "completed", unlinkedListing: false },
  { id: "x", status: "pending", cancelStatus: "cancelled", unlinkedListing: false },
  listingToJob({
    id: "flown",
    status: "accepted",
    bookingId: null,
    source: "zeitview",
    payout: 70,
    dueWindowStart: "2024-01-25T19:30:00.000Z",
  }),
];
const overviewCounts = overviewStatusCounts(overviewJobs);
assert.equal(overviewGigStatus(overviewJobs[0]), "pending");
assert.equal(overviewGigStatus(overviewJobs[4]), "cancelled");
assert.equal(overviewGigStatus(overviewJobs[5]), "completed");
assert.equal(overviewCounts.all, 6);
assert.equal(overviewCounts.pending, 1);
assert.equal(overviewCounts.confirmed, 1);
assert.equal(overviewCounts["in-progress"], 1);
assert.equal(overviewCounts.completed, 2);
assert.equal(overviewCounts.cancelled, 1);
assert.equal(overviewCounts.open, 3);
assert.deepEqual(filterOverviewJobs(overviewJobs, "all").map((job) => job.id), ["p", "c", "i", "d", "x", "flown"]);
assert.deepEqual(filterOverviewJobs(overviewJobs, "pending").map((job) => job.id), ["p"]);
assert.deepEqual(filterOverviewJobs(overviewJobs, "open").map((job) => job.id), ["p", "c", "i"]);
assert.equal(filterOverviewJobs(overviewJobs, "cancelled").length, 1);
assert.equal(openGigsLabel(3), "3 open gigs need attention");
assert.equal(openGigsLabel(1), "1 open gig needs attention");
assert.equal(openGigsLabel(0), "0 open gigs need attention");

console.log("Admin role and unlinked earnings checks passed.");
