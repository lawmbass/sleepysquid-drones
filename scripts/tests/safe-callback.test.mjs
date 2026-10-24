import test from "node:test";
import assert from "node:assert/strict";
import { safeCallback } from "../../libs/origin/index.js";

const D = "https://drones.sleepysquid.com";
test("relative paths pass", () => {
  assert.equal(safeCallback("/dashboard?section=bot-rules", D), "/dashboard?section=bot-rules");
});
test("same-origin and SleepySquid absolute URLs pass", () => {
  assert.equal(safeCallback(`${D}/dashboard`, D), `${D}/dashboard`);
  assert.equal(safeCallback("https://sleepysquid.com/x", D), "https://sleepysquid.com/x");
  assert.equal(safeCallback("http://localhost:3000/d", "http://localhost:3000"), "http://localhost:3000/d");
});
test("off-origin and malformed callbacks fall back", () => {
  for (const bad of ["https://evil.com/", "//evil.com", "/\\evil.com", "javascript:alert(1)", "http://drones.sleepysquid.com/x", "https://sleepysquid.com.evil.com/", "nonsense", ""]) {
    assert.equal(safeCallback(bad, D), "/dashboard", bad);
  }
  assert.equal(safeCallback(undefined, D, "/home"), "/home");
});
