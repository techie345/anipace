// Shared AniList two-way sync helpers (pure + thin GraphQL wrappers).
// Authenticated calls need a user access token from AniList OAuth.

import type { EntryStatus, MediaKind } from "@/lib/db";

export const ANILIST_ENDPOINT = "https://graphql.anilist.co";
export const ANILIST_AUTH_URL = "https://anilist.co/api/v2/oauth/authorize";
export const ANILIST_TOKEN_URL = "https://anilist.co/api/v2/oauth/token";

type AniListStatus =
  | "CURRENT"
  | "PLANNING"
  | "COMPLETED"
  | "DROPPED"
  | "PAUSED"
  | "REPEATING";

export function toAniListStatus(
  status: EntryStatus,
  kind: MediaKind,
): AniListStatus {
  switch (status) {
    case "watching":
    case "reading":
      return "CURRENT";
    case "completed":
      return "COMPLETED";
    case "dropped":
      return "DROPPED";
    case "on_hold":
      return "PAUSED";
    case "plan_to_watch":
    case "plan_to_read":
      return "PLANNING";
    default:
      return kind === "manga" ? "PLANNING" : "PLANNING";
  }
}

export function fromAniListStatus(
  status: string,
  kind: MediaKind,
): EntryStatus {
  switch (status) {
    case "CURRENT":
    case "REPEATING":
      return kind === "manga" ? "reading" : "watching";
    case "COMPLETED":
      return "completed";
    case "DROPPED":
      return "dropped";
    case "PAUSED":
      return "on_hold";
    case "PLANNING":
    default:
      return kind === "manga" ? "plan_to_read" : "plan_to_watch";
  }
}

/** Local 0-10 score → AniList raw 0-100. Null stays null. */
export function toAniListScore(score: number | null): number | null {
  if (score == null) return null;
  return Math.max(0, Math.min(100, Math.round(score * 10)));
}

/** AniList raw 0-100 → local 0-10. Handles 0 as null (unscored). */
export function fromAniListScore(raw: number | null | undefined): number | null {
  if (raw == null || raw === 0) return null;
  return Math.max(0, Math.min(10, Math.round((raw / 100) * 10)));
}

export function buildAuthorizeUrl(args: {
  clientId: string;
  redirectUri: string;
}): string {
  const u = new URL(ANILIST_AUTH_URL);
  u.searchParams.set("client_id", args.clientId);
  u.searchParams.set("redirect_uri", args.redirectUri);
  u.searchParams.set("response_type", "code");
  return u.toString();
}

/** Canonical redirect URI for AniList OAuth.
 * Override with ANILIST_REDIRECT_URI when the URL registered in
 * anilist.co/settings/developer differs (e.g. /auth/callback/anilist). */
export function getAnilistRedirectUri(req: Request): string {
  const override = process.env.ANILIST_REDIRECT_URI?.trim();
  if (override) return override;
  return `${new URL(req.url).origin}/api/anilist/callback`;
}

export async function exchangeCodeForToken(args: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}): Promise<{ access_token: string; expires_in?: number }> {
  const res = await fetch(ANILIST_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: args.clientId,
      client_secret: args.clientSecret,
      redirect_uri: args.redirectUri,
      code: args.code,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`AniList token exchange failed: ${res.status}`);
  return (await res.json()) as { access_token: string; expires_in?: number };
}

async function authedGql<T>(
  token: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(ANILIST_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error("AniList token expired — reconnect.");
    throw new Error(`AniList error: ${res.status}`);
  }
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data as T;
}

export interface RemoteListEntry {
  mediaId: number;
  status: string;
  progress: number;
  scoreRaw: number;
  updatedAt?: number;
  media: {
    id: number;
    title: { english: string | null; romaji: string | null };
    coverImage: { large: string | null };
    episodes: number | null;
    chapters: number | null;
  };
}

/** Pull the viewer's own anime+manga lists using their OAuth token. */
export async function pullViewerLists(token: string) {
  const viewer = await authedGql<{ Viewer: { id: number } }>(
    token,
    `query { Viewer { id } }`,
    {},
  );
  const id = viewer.Viewer.id;
  async function collection(type: "ANIME" | "MANGA") {
    const data = await authedGql<{
      MediaListCollection: {
        lists: { entries: RemoteListEntry[] }[];
      } | null;
    }>(
      token,
      `query ($userId: Int, $type: MediaType) {
        MediaListCollection(userId: $userId, type: $type) {
          lists { entries {
            mediaId status progress scoreRaw: score(raw: true) updatedAt
            media { id title { english romaji } coverImage { large } episodes chapters }
          } }
        }
      }`,
      { userId: id, type },
    );
    return data.MediaListCollection?.lists.flatMap((l) => l.entries) ?? [];
  }
  const [anime, manga] = await Promise.all([collection("ANIME"), collection("MANGA")]);
  return { anime, manga };
}

/** Push one entry to AniList (creates/updates the viewer's list entry). */
export async function pushEntryToAniList(
  token: string,
  entry: { anilistId: number; status: EntryStatus; progress: number; score: number | null; kind: MediaKind },
): Promise<void> {
  await authedGql(
    token,
    `mutation ($mediaId: Int, $status: MediaListStatus, $progress: Int, $scoreRaw: Int) {
      SaveMediaListEntry(mediaId: $mediaId, status: $status, progress: $progress, scoreRaw: $scoreRaw) { id }
    }`,
    {
      mediaId: entry.anilistId,
      status: toAniListStatus(entry.status, entry.kind),
      progress: entry.progress,
      scoreRaw: toAniListScore(entry.score) ?? 0,
    },
  );
}
