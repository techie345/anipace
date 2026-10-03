import { handleAnilistCallback } from "@/features/sync/anilist-callback";

// GET /api/anilist/callback?code=... — exchange code, store token, redirect.
export async function GET(req: Request) {
  return handleAnilistCallback(req);
}
