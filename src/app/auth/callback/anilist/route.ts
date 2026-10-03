import { handleAnilistCallback } from "@/features/sync/anilist-callback";

// Alias for AniList dashboards that registered /auth/callback/anilist
// instead of /api/anilist/callback. Set ANILIST_REDIRECT_URI to this URL
// so the authorize + token exchange agree on the same redirect_uri.
// GET /auth/callback/anilist?code=...
export async function GET(req: Request) {
  return handleAnilistCallback(req);
}
