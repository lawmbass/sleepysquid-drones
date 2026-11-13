import NextAuth from "next-auth";
import { authOptions } from "@/libs/next-auth";
import { referralCodeFromRequest } from "@/libs/referrals.mjs";
import { runWithReferralCode } from "@/libs/referralContext.mjs";

export default function handler(req, res) {
  return runWithReferralCode(referralCodeFromRequest(req), () => NextAuth(authOptions)(req, res));
} 