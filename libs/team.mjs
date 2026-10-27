/** Browser-safe Team page helpers: the Team page lists staff only (admins and pilots). */
export const TEAM_ROLES = ['admin', 'pilot'];

// Stats for the Team page, counted over the team rows only (users + pending invitations).
export function teamStats(items) {
  const users = items.filter((i) => !i.isPendingInvitation);
  return {
    total: items.length,
    users: users.length,
    pendingInvitations: items.length - users.length,
    withAccess: users.filter((u) => u.hasAccess).length,
    withoutAccess: users.filter((u) => !u.hasAccess).length,
    roles: { admin: items.filter((i) => i.role === 'admin').length, pilot: items.filter((i) => i.role === 'pilot').length, client: 0 },
  };
}
