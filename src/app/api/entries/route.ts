import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { userKey } from "@/lib/current-user";
import {
  deleteEntry,
  isDbConfigured,
  listEntries,
  upsertEntry,
  type Entry,
  type EntryStatus,
  type MediaKind,
} from "@/lib/db";

function parseBody(json: unknown): Omit<Entry, "userId" | "updatedAt" | "id"> & { id?: string } {
  const b = json as Record<string, unknown>;
  const kind = b.kind === "manga" ? ("manga" as MediaKind) : ("anime" as MediaKind);
  return {
    id: typeof b.id === "string" ? b.id : undefined,
    kind,
    title: String(b.title ?? "Untitled"),
    coverUrl: typeof b.coverUrl === "string" ? b.coverUrl : null,
    status: (typeof b.status === "string" ? b.status : "plan_to_watch") as EntryStatus,
    progress: Number(b.progress ?? 0),
    total: b.total == null ? null : Number(b.total),
    score: b.score == null ? null : Number(b.score),
    notes: typeof b.notes === "string" ? b.notes : null,
    anilistId: b.anilistId == null ? null : Number(b.anilistId),
  };
}

// GET /api/entries?kind=anime — server list (DB mode). Falls back to 503 so the
// client uses localStorage when no DATABASE_URL is configured.
export async function GET(req: Request) {
  if (!isDbConfigured())
    return NextResponse.json({ fallback: true }, { status: 503 });
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const kind = new URL(req.url).searchParams.get("kind");
  const entries = await listEntries(
    userKey(session),
    kind === "anime" || kind === "manga" ? kind : undefined,
  );
  return NextResponse.json({ entries });
}

export async function POST(req: Request) {
  if (!isDbConfigured())
    return NextResponse.json({ fallback: true }, { status: 503 });
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const entry = await upsertEntry(
    userKey(session),
    parseBody(await req.json()),
  );
  return NextResponse.json({ entry }, { status: 201 });
}

export async function PUT(req: Request) {
  if (!isDbConfigured())
    return NextResponse.json({ fallback: true }, { status: 503 });
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const entry = await upsertEntry(
    userKey(session),
    parseBody(await req.json()),
  );
  return NextResponse.json({ entry });
}

export async function DELETE(req: Request) {
  if (!isDbConfigured())
    return NextResponse.json({ fallback: true }, { status: 503 });
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const ok = await deleteEntry(userKey(session), id);
  return NextResponse.json({ ok });
}
