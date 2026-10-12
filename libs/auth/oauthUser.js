import { createUser, findUserByEmail, patchUser } from "@/libs/db/users";
import { upsertOAuthAccount } from "@/libs/db/accounts";
import { findPendingInvitationByEmail, updateInvitation } from "@/libs/db/invitations";
import { ADMIN_ROLE_REASON, ensureAdminRole, roleForNewUser } from "@/libs/auth/adminRole";

/**
 * Persist a Google sign-in. NextAuth uses JWT sessions, so this replaces
 * the old MongoDB adapter's user and account records.
 */
export async function upsertGoogleUser({ email, name, image, providerAccountId }) {
  const normalized = email.toLowerCase();
  let user = await findUserByEmail(normalized, { includeSecrets: true });
  let created = false;

  if (!user) {
    const role = roleForNewUser(normalized);
    user = await createUser({
      email: normalized,
      name: name || null,
      image: image || null,
      role,
      roleHistory: role === "admin"
        ? [{
          role: "admin",
          changedAt: new Date().toISOString(),
          changedBy: "system",
          reason: ADMIN_ROLE_REASON,
        }]
        : [],
      hasAccess: true,
      emailVerification: { verified: true },
      accessHistory: [
        {
          hasAccess: true,
          changedBy: "system",
          changedAt: new Date().toISOString(),
          reason: "Auto-granted access for OAuth user",
          action: "created",
        },
      ],
    });
    created = true;
  } else if (!user.emailVerification?.verified) {
    user = await patchUser(user.id, {
      image: image || undefined,
      emailVerification: { verified: true },
      hasAccess: true,
      pushAccessHistory: {
        hasAccess: true,
        changedBy: "system",
        changedAt: new Date().toISOString(),
        reason: "Google account verification",
        action: "activated",
      },
    });
  } else if (image && image !== user.image) {
    user = await patchUser(user.id, { image });
  }

  if (providerAccountId) {
    await upsertOAuthAccount({
      userId: user.id,
      provider: "google",
      providerAccountId: String(providerAccountId),
    });
  }

  if (created) {
    const invitation = await findPendingInvitationByEmail(normalized);
    if (invitation && !invitation.isExpired) {
      await patchUser(user.id, {
        role: invitation.role,
        hasAccess: invitation.hasAccess,
        company: invitation.company || null,
        phone: invitation.phone || null,
        name: invitation.name || user.name,
        pushRoleHistory: {
          role: invitation.role,
          changedAt: new Date().toISOString(),
          changedBy: invitation.invitedBy,
          reason: "Initial role assignment from invitation",
        },
      });
      await updateInvitation(invitation.id, {
        status: "accepted",
        acceptedAt: new Date().toISOString(),
      });
    }
  }

  const latest = await findUserByEmail(normalized);
  return ensureAdminRole(latest);
}
