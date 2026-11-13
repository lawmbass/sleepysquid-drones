import { AsyncLocalStorage } from "node:async_hooks";
import { referralCodeOrNull } from "./referrals.mjs";

const storage = new AsyncLocalStorage();

/** Node-only. Not imported by middleware (that runs on the Edge runtime). */
export function runWithReferralCode(code, fn) {
  return storage.run(referralCodeOrNull(code), fn);
}

export function currentReferralCode() {
  return referralCodeOrNull(storage.getStore());
}
