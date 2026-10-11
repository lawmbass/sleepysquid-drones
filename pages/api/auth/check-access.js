import { findUserByEmail } from "@/libs/db/users";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const user = await findUserByEmail(email.toLowerCase());

    if (!user) {
      return res.status(404).json({
        hasAccess: false,
        error: "User not found",
      });
    }

    return res.status(200).json({
      hasAccess: user.hasAccess || false,
      role: user.role,
      email: user.email,
    });
  } catch (error) {
    console.error("Error checking user access:", error);
    return res.status(500).json({
      hasAccess: false,
      error: "Internal server error",
    });
  }
}
