import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

export type MediaKind = "anime" | "manga";
export type EntryStatus =
  | "watching"
  | "reading"
  | "completed"
  | "on_hold"
  | "dropped"
  | "plan_to_watch"
  | "plan_to_read";

export interface Entry {
  id: string;
  userId: string;
  kind: MediaKind;
  title: string;
  coverUrl: string | null;
  status: EntryStatus;
  progress: number;
  total: number | null;
  score: number | null; // 0-10
  notes: string | null;
  anilistId: number | null;
  updatedAt: string;
}

let sql: NeonQueryFunction<false, false> | null = null;
let ensured = false;

function client() {
  if (sql) return sql;
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) return null;
  sql = neon(url);
  return sql;
}

export function isDbConfigured() {
  return Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL);
}

async function ensureSchema(): Promise<boolean> {
  const db = client();
  if (!db) return false;
  if (ensured) return true;
  await db`
    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('anime', 'manga')),
      title TEXT NOT NULL,
      cover_url TEXT,
      status TEXT NOT NULL DEFAULT 'plan_to_watch',
      progress INTEGER NOT NULL DEFAULT 0,
      total INTEGER,
      score INTEGER CHECK (score IS NULL OR (score >= 0 AND score <= 10)),
      notes TEXT,
      anilist_id INTEGER,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  await db`
    CREATE INDEX IF NOT EXISTS entries_user_kind_idx ON entries (user_id, kind);
  `;
  await db`
    CREATE TABLE IF NOT EXISTS anilist_tokens (
      user_id TEXT PRIMARY KEY,
      access_token TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  // One-time normalization: user keys are now lowercase emails
  // (see src/lib/current-user.ts), so fold any legacy mixed-case keys.
  await db`
    UPDATE entries SET user_id = LOWER(user_id)
    WHERE user_id LIKE '%@%' AND user_id <> LOWER(user_id);
  `;
  await db`
    UPDATE anilist_tokens SET user_id = LOWER(user_id), updated_at = NOW()
    WHERE user_id LIKE '%@%' AND user_id <> LOWER(user_id)
    AND NOT EXISTS (
      SELECT 1 FROM anilist_tokens t2 WHERE t2.user_id = LOWER(anilist_tokens.user_id)
    );
  `;
  ensured = true;
  return true;
}

function toEntry(row: Record<string, unknown>): Entry {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    kind: row.kind as MediaKind,
    title: String(row.title),
    coverUrl: (row.cover_url as string | null) ?? null,
    status: row.status as EntryStatus,
    progress: Number(row.progress),
    total: row.total == null ? null : Number(row.total),
    score: row.score == null ? null : Number(row.score),
    notes: (row.notes as string | null) ?? null,
    anilistId: row.anilist_id == null ? null : Number(row.anilist_id),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };
}

export async function listEntries(
  userId: string,
  kind?: MediaKind,
): Promise<Entry[] | null> {
  const db = client();
  if (!db) return null;
  await ensureSchema();
  const rows = kind
    ? await db`SELECT * FROM entries WHERE user_id = ${userId} AND kind = ${kind} ORDER BY updated_at DESC`
    : await db`SELECT * FROM entries WHERE user_id = ${userId} ORDER BY updated_at DESC`;
  return rows.map(toEntry);
}

export async function upsertEntry(
  userId: string,
  data: Omit<Entry, "userId" | "updatedAt" | "id"> & { id?: string },
): Promise<Entry | null> {
  const db = client();
  if (!db) return null;
  await ensureSchema();
  const id =
    data.id ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const rows = await db`
    INSERT INTO entries (id, user_id, kind, title, cover_url, status, progress, total, score, notes, anilist_id, updated_at)
    VALUES (${id}, ${userId}, ${data.kind}, ${data.title}, ${data.coverUrl}, ${data.status}, ${data.progress}, ${data.total}, ${data.score}, ${data.notes}, ${data.anilistId}, NOW())
    ON CONFLICT (id) DO UPDATE SET
      kind = EXCLUDED.kind, title = EXCLUDED.title, cover_url = EXCLUDED.cover_url,
      status = EXCLUDED.status, progress = EXCLUDED.progress, total = EXCLUDED.total,
      score = EXCLUDED.score, notes = EXCLUDED.notes, anilist_id = EXCLUDED.anilist_id,
      updated_at = NOW()
    RETURNING *;
  `;
  return toEntry(rows[0] as Record<string, unknown>);
}

export async function deleteEntry(
  userId: string,
  id: string,
): Promise<boolean | null> {
  const db = client();
  if (!db) return null;
  await ensureSchema();
  const rows =
    await db`DELETE FROM entries WHERE id = ${id} AND user_id = ${userId} RETURNING id`;
  return rows.length > 0;
}

export async function statsFor(
  userId: string,
): Promise<{ anime: number; manga: number; completed: number } | null> {
  const db = client();
  if (!db) return null;
  await ensureSchema();
  const rows = await db`
    SELECT
      COUNT(*) FILTER (WHERE kind = 'anime') AS anime,
      COUNT(*) FILTER (WHERE kind = 'manga') AS manga,
      COUNT(*) FILTER (WHERE status = 'completed') AS completed
    FROM entries WHERE user_id = ${userId};
  `;
  const r = rows[0] as Record<string, unknown>;
  return {
    anime: Number(r.anime),
    manga: Number(r.manga),
    completed: Number(r.completed),
  };
}

export async function saveAnilistToken(
  userId: string,
  accessToken: string,
): Promise<boolean> {
  const db = client();
  if (!db) return false;
  await ensureSchema();
  await db`
    INSERT INTO anilist_tokens (user_id, access_token, updated_at)
    VALUES (${userId}, ${accessToken}, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      access_token = EXCLUDED.access_token, updated_at = NOW();
  `;
  return true;
}

export async function getAnilistToken(
  userId: string,
): Promise<string | null> {
  const db = client();
  if (!db) return null;
  await ensureSchema();
  const rows =
    await db`SELECT access_token FROM anilist_tokens WHERE user_id = ${userId} LIMIT 1`;
  if (rows.length === 0) return null;
  return String((rows[0] as Record<string, unknown>).access_token);
}

export async function deleteAnilistToken(userId: string): Promise<boolean> {
  const db = client();
  if (!db) return false;
  await ensureSchema();
  await db`DELETE FROM anilist_tokens WHERE user_id = ${userId}`;
  return true;
}
