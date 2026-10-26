import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { buildContactEmail, buildBookingEmail, CONTACT_HEADER_IMG, BOOKING_HEADER_IMG } from "../../libs/droneEmails.mjs";

const contact = { name: "Jo <b>Lee</b>", email: "jo@example.com", subject: "Roof & survey", message: "Hi\n<script>x</script>", timestamp: "10/25/2026", clientIp: "1.2.3.4", userAgent: "UA" };
const booking = { id: "abc123", name: "Sam", serviceDisplayName: "Real Estate", packageDisplayName: "Standard", formattedDate: "November 2, 2026", location: "Austin, TX", estimatedPriceLabel: "from $250", details: "Gate <code> 42" };
const opts = { hasAccount: false, loginUrl: "https://drones.sleepysquid.com/login", appName: "SleepySquid Drones", supportEmail: "support@sleepysquid.com" };

test("contact email: escapes input, keeps every field, dark-mode ready", () => {
  const { html, text } = buildContactEmail(contact);
  assert.ok(!html.includes("<script>") && !html.includes("<b>Lee"));
  assert.ok(html.includes("Roof &amp; survey") && html.includes("Hi<br>&lt;script&gt;"));
  for (const v of ["jo@example.com", "10/25/2026", "1.2.3.4", "UA", CONTACT_HEADER_IMG, 'name="color-scheme" content="light dark"', "prefers-color-scheme: dark"]) assert.ok(html.includes(v), v);
  for (const v of ["From: Jo <b>Lee</b>", "Email: jo@example.com", "Subject: Roof & survey", "IP Address: 1.2.3.4", "User Agent: UA", "Submitted: 10/25/2026"]) assert.ok(text.includes(v), v);
});

test("contact email: empty fields hidden", () => {
  const { html, text } = buildContactEmail({ ...contact, userAgent: "", clientIp: undefined });
  assert.ok(!html.includes("User Agent") && !text.includes("User Agent") && !text.includes("IP Address"));
});

test("booking email: all details, manage link, escaping", () => {
  const { html, text } = buildBookingEmail(booking, opts);
  for (const v of ["abc123", "Real Estate", "Standard", "November 2, 2026", "Austin, TX", "from $250", "Pending Confirmation", "Gate &lt;code&gt; 42", "Manage your bookings", 'href="https://drones.sleepysquid.com/login"', "Create Account &amp; Manage Bookings", "support@sleepysquid.com", "FAA Part 107", BOOKING_HEADER_IMG, "prefers-color-scheme: dark"]) assert.ok(html.includes(v), v);
  for (const v of ["Booking ID: abc123", "Package: Standard", "Estimated Price: from $250", "Visit: https://drones.sleepysquid.com/login", "4. You'll receive a final confirmation"]) assert.ok(text.includes(v), v);
});

test("booking email: account section hidden for account holders; empty optional rows hidden; location TBD", () => {
  const { html, text } = buildBookingEmail({ ...booking, packageDisplayName: null, estimatedPriceLabel: "", details: "", location: "" }, { ...opts, hasAccount: true });
  assert.ok(!html.includes("Manage your bookings") && !text.includes("MANAGE YOUR BOOKINGS"));
  assert.ok(!html.includes(">Package<") && !html.includes("Estimated Price") && !html.includes("Additional details"));
  assert.ok(text.includes("Location: TBD"));
});

test("senders use the shared builders, subjects unchanged; header images exist", () => {
  const c = readFileSync("pages/api/contact.js", "utf8"), e = readFileSync("libs/emailService.js", "utf8");
  assert.ok(c.includes("buildContactEmail(") && c.includes("New Contact Form Submission: ${sanitizedData.subject}") && c.includes("replyTo: sanitizedData.email"));
  assert.ok(e.includes("buildBookingEmail(") && e.includes("Booking Confirmation - ") && e.includes("to: booking.email"));
  for (const f of ["drones-contact-header.png", "drones-booking-header.png"]) assert.ok(existsSync("public/email/" + f), f);
});
