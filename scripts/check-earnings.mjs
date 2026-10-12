import assert from "node:assert/strict";

const { selectUnlinkedEarnings, unlinkedPayoutTotal } = await import("../libs/earnings.js");
const { mergeJobs, summarizeJobs, summarizeAnalytics, listingToJob, listingSchedule } = await import("../libs/jobs.js");
const { buildCancelDraft, gmailComposeUrl, mailtoUrl, flightWarning } = await import("../libs/cancelGig.js");
const { adminConfig } = await import("../libs/adminConfig.js");

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

const spacedTimeIgnored = listingToJob({
  id: "spaced-time",
  lastSeenAt: "2026-10-11T23:00:00.000Z",
  rawDetail: { text: "Download KML\n05/27/2025\n02:30 PM\nYou must arrive on time on the scheduled flight date…" },
});
assert.equal(spacedTimeIgnored.date, "2026-10-11T23:00:00.000Z");
assert.equal(spacedTimeIgnored.scheduleSource, "last_seen");

const seenOnly = listingToJob({
  id: "seen-only",
  lastSeenAt: "2026-10-11T23:00:00.000Z",
  rawDetail: { title: "No schedule stored" },
});
assert.equal(seenOnly.date, "2026-10-11T23:00:00.000Z");
assert.equal(seenOnly.hasFlightTime, false);
assert.equal(seenOnly.scheduleSource, "last_seen");

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

console.log("Admin role and unlinked earnings checks passed.");
