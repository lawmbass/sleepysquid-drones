#!/usr/bin/env node
/**
 * Drive the public pricing section into the booking form. Does not submit.
 *
 * Usage (from the repo root, after launch.sh and doctor.mjs):
 *   node .cursor/skills/verify-sleepysquid-drones/scripts/drive-pricing.mjs
 *
 * Chrome: CHROME_PATH (default /usr/local/bin/google-chrome).
 * puppeteer-core is installed under $VERIFY_STATE/tools on first run.
 */
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const STATE = process.env.VERIFY_STATE || "/tmp/verify-sleepysquid-drones";
const evidenceDir = path.join(STATE, "evidence");
fs.mkdirSync(evidenceDir, { recursive: true });

const base = fs.readFileSync(path.join(STATE, "base-url"), "utf8").trim();
const parsedBase = new URL(base);
if (parsedBase.hostname !== "127.0.0.1" && parsedBase.hostname !== "localhost") {
  throw new Error(`refusing to drive ${base}`);
}

const tools = path.join(STATE, "tools");
fs.mkdirSync(tools, { recursive: true });
let puppeteer;
try {
  puppeteer = createRequire(path.join(tools, "package.json"))("puppeteer-core");
} catch {
  execSync("npm install --prefix " + JSON.stringify(tools) + " puppeteer-core@24.15.0", {
    stdio: "inherit",
  });
  puppeteer = createRequire(path.join(tools, "package.json"))("puppeteer-core");
}

const chrome = process.env.CHROME_PATH || "/usr/local/bin/google-chrome";
const requests = [];
const blocked = [];

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const raw = request.url();
    const inline = raw.startsWith("data:") || raw.startsWith("blob:");
    let host = "";
    if (!inline) {
      try { host = new URL(raw).hostname; } catch { host = ""; }
    }
    const local = inline || host === "127.0.0.1" || host === "localhost";
    let pathname = "";
    if (!inline) {
      try { pathname = new URL(raw).pathname; } catch { pathname = ""; }
    }
    // next-auth's client logger. It does not send mail or touch Supabase.
    const authLog = local && request.method() === "POST" && pathname === "/api/auth/_log";
    const record = {
      method: request.method(),
      url: inline ? raw.slice(0, 32) : raw,
      local,
    };
    if (authLog) {
      requests.push(record);
      request.continue().catch(() => {});
      return;
    }
    if (!local || !["GET", "HEAD"].includes(request.method())) {
      blocked.push(record);
      request.abort().catch(() => {});
      return;
    }
    requests.push(record);
    request.continue().catch(() => {});
  });

  const response = await page.goto(base + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
  if (!response || response.status() !== 200) {
    throw new Error(`GET / status ${response && response.status()}`);
  }

  await page.waitForSelector("#pricing h3");
  await page.click('a[href="/#pricing"]');
  await page.waitForSelector("#pricing");

  const packages = await page.$$eval("#pricing h3", (nodes) => nodes.map((node) => node.textContent.trim()));
  const expected = ["Listing Photos", "Listing Photos + Video", "Event Aerials", "Mapping & 3D"];
  for (const name of expected) {
    if (!packages.includes(name)) throw new Error(`pricing card missing ${name}; saw ${packages.join(", ")}`);
  }
  const pricingText = await page.$eval("#pricing", (node) => node.innerText);
  for (const bit of ["$199", "from $500", "$900", "Best for listings", "48-hour delivery", "Travel fees may apply"]) {
    if (!pricingText.includes(bit)) throw new Error(`pricing text missing ${bit}`);
  }

  await page.evaluate(() => {
    const heading = [...document.querySelectorAll("#pricing h3")].find((node) => node.textContent.trim() === "Listing Photos");
    const button = heading?.closest("div")?.querySelector("button");
    if (!button || button.textContent.trim() !== "Book This Package") {
      throw new Error("Listing Photos card has no Book This Package button");
    }
    button.click();
  });

  await page.waitForSelector("#booking");
  await page.waitForFunction(() => {
    const service = document.querySelector("#service");
    const pack = document.querySelector("#package");
    return service && service.value === "real-estate" && pack && pack.value === "listing-photos";
  }, { timeout: 5000 });

  const state = await page.evaluate(() => {
    const next = [...document.querySelectorAll("#booking button")].find((button) => button.textContent.trim() === "Next Step");
    return {
      service: document.querySelector("#service").value,
      package: document.querySelector("#package").value,
      nextDisabled: Boolean(next && next.disabled),
      step1Visible: Boolean(document.querySelector("#booking #service")),
      confirmation: document.body.innerText.includes("Booking Submitted!"),
    };
  });
  if (state.service !== "real-estate" || state.package !== "listing-photos") {
    throw new Error(`form state ${JSON.stringify(state)}`);
  }
  if (!state.nextDisabled) throw new Error("Next Step was enabled without a selected US address");
  if (state.confirmation) throw new Error("booking confirmation rendered; the form was submitted");

  await page.evaluate(() => {
    // styles/globals.css sets scroll-behavior: smooth on html, so scrollIntoView
    // without waiting photographs the old position. instant scrollTo lands now.
    const el = document.querySelector("#booking");
    const top = el.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
  });
  const bookingShot = await page.$("#booking");
  await bookingShot.screenshot({ path: path.join(evidenceDir, "pricing-booking.png") });
  // Programmatic scrollTo is easy to lose against the smooth-scroll CSS, and a
  // clip taken from an off-screen box photographs the hero instead. Wheel until
  // the Listing Photos heading is actually in the viewport and opaque.
  await page.mouse.move(640, 450);
  let cardsReady = false;
  let cardProbe = null;
  for (let i = 0; i < 12 && !cardsReady; i += 1) {
    cardProbe = await page.evaluate(() => {
      const heading = [...document.querySelectorAll("#pricing h3")].find((node) => node.textContent.trim() === "Listing Photos");
      if (!heading) return { ok: false };
      const top = heading.getBoundingClientRect().top;
      const opacity = Number.parseFloat(getComputedStyle(heading).opacity);
      return { ok: top > 40 && top < 450 && opacity > 0.95, top, opacity, scrollY: window.scrollY };
    });
    cardsReady = cardProbe.ok;
    if (!cardsReady) {
      await page.mouse.wheel({ deltaY: cardProbe.top < 40 ? -800 : 800 });
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  if (!cardsReady) throw new Error(`pricing cards did not scroll into view ${JSON.stringify(cardProbe)}`);
  const grid = await page.$("#pricing .grid");
  await grid.screenshot({ path: path.join(evidenceDir, "pricing-cards.png") });
  await page.screenshot({ path: path.join(evidenceDir, "pricing-page.png"), fullPage: false });

  await page.goto(base + "/login", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("#email", { timeout: 15000 });
  await page.waitForSelector("#password");
  const loginFields = await page.evaluate(() => ({
    email: document.querySelector("#email").value,
    password: document.querySelector("#password").value,
    signIn: [...document.querySelectorAll("button")].some((button) => button.textContent.trim() === "Sign In"),
  }));
  if (loginFields.email !== "" || loginFields.password !== "" || !loginFields.signIn) {
    throw new Error(`login form was not empty: ${JSON.stringify(loginFields)}`);
  }
  await page.screenshot({ path: path.join(evidenceDir, "login.png") });

  const promo = requests.filter((entry) => entry.url.includes("/api/promo/active"));
  const report = {
    ok: blocked.length === 0,
    base,
    packages,
    state,
    loginFields,
    promoRequests: promo.length,
    requestCount: requests.length,
    blocked,
  };
  fs.writeFileSync(path.join(evidenceDir, "drive.json"), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(evidenceDir, "requests.json"), JSON.stringify(requests, null, 2));
  if (blocked.length) {
    console.error(JSON.stringify(blocked, null, 2));
    throw new Error(`blocked ${blocked.length} non-local or non-GET request(s)`);
  }
  console.log(`drive: pass service=${state.service} package=${state.package} nextDisabled=${state.nextDisabled} promoGets=${promo.length}`);
} finally {
  await browser.close();
}
