import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getAnilistToken,
  isDbConfigured,
  listEntries,
  upsertEntry,
} from "@/lib/db";
import {
  fromAniListScore,
  fromAniListStatus,
  pullViewerLists,
  pushEntryToAniList,
  sleep,
  PUSH_THROTTLE_MS,
} from "@/features/sync/anilist-sync";
import { userKey } from "@/lib/current-user";

function uidOf(session: { user?: { email?: string | null; name?: string | null } }) {
  return userKey(session);
}

// POST /api/anilist/sync { direction?: "pull"|"push"|"both" }
// pull: AniList → local DB (upsert matched by anilistId)
// push: local → AniList (SaveMediaListEntry per entry with anilistId)
// both (default): pull first, then push locals (last-write-wins toward AniList
// for entries existing on both sides).
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isDbConfigured())
    return NextResponse.json(
      { error: "Database required for sync." },
      { status: 503 },
    );
  const uid = uidOf(session);
  const token = await getAnilistToken(uid);
  if (!token)
    return NextResponse.json(
      { error: "AniList not connected — visit /api/anilist/auth first." },
      { status: 409 },
    );

  const { direction } = (await req.json().catch(() => ({}))) as {
    direction?: string;
  };
  const doPull = direction !== "push";
  const doPush = direction !== "pull";

  try {
    let pulled = 0;
    const pulledIds = new Set<number>();
    if (doPull) {
      const { anime, manga, scoreFormat } = await pullViewerLists(token);
      const existing = (await listEntries(uid)) ?? [];
      const byAnilist = new Map(
        existing.filter((e) => e.anilistId != null).map((e) => [e.anilistId as number, e]),
      );
      const all = [
        ...anime.map((e) => ({ e, kind: "anime" as const })),
        ...manga.map((e) => ({ e, kind: "manga" as const })),
      ];
      for (const { e, kind } of all) {
        const prev = byAnilist.get(e.mediaId);
        await upsertEntry(uid, {
          id: prev?.id,
          kind,
          title:
            e.media.title.english ?? e.media.title.romaji ?? prev?.title ?? "Unknown title",
          coverUrl: e.media.coverImage.large ?? prev?.coverUrl ?? null,
          status: fromAniListStatus(e.status, kind),
          progress: e.progress ?? 0,
          total:
            (kind === "manga" ? e.media.chapters : e.media.episodes) ??
            prev?.total ??
            null,
          score: fromAniListScore(e.score, scoreFormat) ?? prev?.score ?? null,
          notes: prev?.notes ?? null,
          anilistId: e.mediaId,
        });
        pulledIds.add(e.mediaId);
        pulled++;
      }
    }

    let pushed = 0;
    let skipped = 0;
    if (doPush) {
      const entries = (await listEntries(uid)) ?? [];
      let first = true;
      for (const entry of entries) {
        if (entry.anilistId == null) continue;
        // Just pulled this one from AniList this run, so local already
        // equals remote — pushing it back would only burn rate limit
        // (and drift scores through 0-100 → 0-10 → 0-100 rounding).
        if (doPull && pulledIds.has(entry.anilistId)) {
          skipped++;
          continue;
        }
        if (!first) await sleep(PUSH_THROTTLE_MS);
        first = false;
        await pushEntryToAniList(token, {
          anilistId: entry.anilistId,
          status: entry.status,
          progress: entry.progress,
          score: entry.score,
          kind: entry.kind,
        });
        pushed++;
      }
    }

    return NextResponse.json({ pulled, pushed, skipped });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sync failed";
    const status = msg.includes("expired") ? 401 : 502;
    return NextResponse.json({ error: msg }, { status });
  }
}
