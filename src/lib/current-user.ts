// Stable per-user key shared by every server route.
// Same email on GitHub and Discord → same key → same entries + AniList token.
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
