import { listAllBookings } from "@/libs/db/bookings";
import { SERVICE_LINES, normalizeServiceLine } from "../serviceLines.js";
import {
  activeSubscribersByService,
  productServiceMap,
  revenueByService,
  stripeConfigured,
} from "@/libs/hub/stripe";

const DAY = 24 * 60 * 60 * 1000;
const CLOSED = new Set(["cancelled", "completed"]);

/**
 * Cross-service overview. Every number comes from a real source; a service
 * with no data reports null/0 and the UI shows an empty state. Each source
 * reports its own status so one outage does not blank the page.
 */
export async function buildHubOverview(now = Date.now()) {
  const sinceUnix = Math.floor((now - 365 * DAY) / 1000);
  const services = Object.fromEntries(SERVICE_LINES.map((s) => [s.id, {
    id: s.id,
    label: s.label,
    activeClients: 0,
    bookingClients: 0,
    stripeSubscribers: 0,
    revenueCents: 0,
    paidInvoices: 0,
    upcomingJobs: 0,
  }]));
  const sources = { bookings: "ok", stripe: stripeConfigured() ? "ok" : "not_configured" };
  const upcoming = [];
  let revenue = null;

  // Bookings: upcoming jobs and recent booking clients (last 90 days or upcoming).
  const clientEmails = Object.fromEntries(SERVICE_LINES.map((s) => [s.id, new Set()]));
  try {
    const bookings = await listAllBookings({});
    for (const booking of bookings) {
      const line = normalizeServiceLine(booking.serviceLine);
      const when = new Date(booking.date).getTime();
      const open = !CLOSED.has(booking.status);
      if (open && when >= now) {
        services[line].upcomingJobs += 1;
        upcoming.push({
          id: booking.id,
          serviceLine: line,
          name: booking.name || booking.email || "Client",
          date: booking.date,
          status: booking.status,
          source: booking.source,
        });
      }
      const recent = when >= now - 90 * DAY || new Date(booking.createdAt).getTime() >= now - 90 * DAY;
      if (booking.status !== "cancelled" && (recent || (open && when >= now)) && booking.email && booking.source !== "zeitview") {
        clientEmails[line].add(booking.email.toLowerCase());
      }
    }
  } catch (error) {
    console.error("Hub overview bookings failed", error?.message);
    sources.bookings = "error";
  }

  // Stripe: revenue (paid invoices, last 365 days) and active subscribers by service tag.
  let subscribers = null;
  if (sources.stripe === "ok") {
    try {
      const products = await productServiceMap();
      revenue = await revenueByService(sinceUnix, products);
      subscribers = await activeSubscribersByService(products);
      for (const s of SERVICE_LINES) {
        services[s.id].revenueCents = revenue.totals[s.id];
        services[s.id].paidInvoices = revenue.invoiceCounts[s.id];
        services[s.id].stripeSubscribers = subscribers[s.id].size;
      }
    } catch (error) {
      console.error("Hub overview stripe failed", error?.message);
      sources.stripe = "error";
    }
  }

  for (const s of SERVICE_LINES) {
    services[s.id].bookingClients = clientEmails[s.id].size;
    // Booking emails and Stripe customers are different keys, so this can double
    // count one client who both books and subscribes. Shown as a sum with the split.
    services[s.id].activeClients = clientEmails[s.id].size + services[s.id].stripeSubscribers;
  }

  upcoming.sort((a, b) => new Date(a.date) - new Date(b.date));

  return {
    generatedAt: new Date(now).toISOString(),
    revenueWindowDays: 365,
    currency: revenue?.currency || "usd",
    untaggedRevenueCents: revenue?.untagged || 0,
    sources,
    services: SERVICE_LINES.map((s) => services[s.id]),
    totals: {
      activeClients: SERVICE_LINES.reduce((n, s) => n + services[s.id].activeClients, 0),
      revenueCents: SERVICE_LINES.reduce((n, s) => n + services[s.id].revenueCents, 0),
      upcomingJobs: upcoming.length,
    },
    upcoming: upcoming.slice(0, 10),
  };
}
