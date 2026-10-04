// Stable per-user key shared by every server route.
// Keyed by canonical email; falls back to name for accounts without email.
// Deliberately simple (no users/accounts tables): fine for a handful of users.

export function canonicalEmail(email: string): string {
  return email.trim().toLowerCase();
}

interface SessionLike {
  userId?: string | null;
  user?: { email?: string | null; name?: string | null } | null;
}

export function userKey(
  session: SessionLike | null | undefined,
): string {
  const email = session?.user?.email;
  if (email) return canonicalEmail(email);
  return session?.user?.name ?? "local-user";
}
