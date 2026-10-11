import { findUserByEmail } from "@/libs/db/users";
import { findOAuthAccountByUserId } from "@/libs/db/accounts";
import { validateEmail, sanitizeInput } from "@/libs/auth-utils";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { email } = req.body;
    const sanitizedEmail = sanitizeInput(email)?.toLowerCase();

    if (!sanitizedEmail) {
      return res.status(400).json({ message: "Email is required" });
    }

    if (!validateEmail(sanitizedEmail)) {
      return res.status(400).json({ message: "Please enter a valid email address" });
    }

    const user = await findUserByEmail(sanitizedEmail, { includeSecrets: true });

    if (!user) {
      return res.status(200).json({
        exists: false,
        message: "No account found with this email",
      });
    }

    const oauthAccount = await findOAuthAccountByUserId(user.id);
    const hasPassword = !!user.password;
    const hasOAuth = !!oauthAccount;

    const accountTypes = [];
    if (hasPassword) accountTypes.push("password");
    if (hasOAuth) accountTypes.push("oauth");

    return res.status(200).json({
      exists: true,
      accountTypes,
      hasPassword,
      hasOAuth,
      emailVerified: user.emailVerification?.verified || false,
      message: hasPassword && hasOAuth
        ? "Account exists with both password and Google sign-in"
        : hasPassword
          ? "Account exists with password. You can also sign in with Google to link your accounts."
          : "Account exists with Google sign-in only",
    });
  } catch (error) {
    console.error("Email check error:", error);
    return res.status(500).json({
      message: "An error occurred while checking the email",
    });
  }
}
