// @vitest-environment node
/**
 * Shared-DB contract test (anipace ↔ cinepace).
 *
 * Both apps point at the same Neon database and the same `entries` table,
 * with users keyed by lowercase Discord email in both. This test boots a
 * throwaway Postgres (PGlite), runs the real migration code in
 * `ensureSchema()` (via the mocked neon client below), and asserts the
 * additive-only contract:
 *
 * - kind CHECK accepts anime, manga, movie AND tv
 * - every cross-app id column exists (anilist_id, tmdb_id, trakt_id)
 * - this app's token table exists (trakt_tokens)
 * - no DROP COLUMN / DROP TABLE in the migration source
 * - existing rows of every kind survive re-running migrations
 *
 * When the sibling repo is checked out next to this one
 * (~/Projects/anipace + ~/Projects/cinepace), the cross-app cases also run
 * both apps' migrations in both orders and assert they converge with data
 * intact. Otherwise those cases skip (e.g. isolated CI checkout).
 *
 * NOTE: this file mirrors cinepace's src/lib/db-contract.test.ts (with
 * OWN_TOKENS_TABLE / SIBLING_DIR swapped). Keep them in sync.
 */
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import type { NeonQueryFunction } from "@neondatabase/serverless";

const holder = vi.hoisted(() => ({ pg: null as PGlite | null }));

// Route the app's neon client at throwaway PGlite.
vi.mock("@neondatabase/serverless", () => ({
  neon: (): NeonQueryFunction<false, false> => {
    const tag = (async (
      strings: TemplateStringsArray,
      ...values: unknown[]
    ) => {
      let sql = strings[0];
      for (let i = 0; i < values.length; i++)
        sql += `$${i + 1}${strings[i + 1]}`;
      const res = await holder.pg!.query(sql, values as never[]);
      return res.rows;
    }) as unknown as NeonQueryFunction<false, false>;
    return tag;
  },
}));

// ---- the contract (weakening this weakens the guarantee — review closely)
const CONTRACT_KINDS = ["anime", "manga", "movie", "tv"] as const;
const CONTRACT_COLUMNS = [
  "id",
  "user_id",
  "kind",
  "title",
  "cover_url",
  "status",
  "progress",
  "total",
  "score",
  "notes",
  "anilist_id",
  "tmdb_id",
  "trakt_id",
  "updated_at",
];
const OWN_TOKENS_TABLE = "anilist_tokens";
const SIBLING_DIR = "cinepace";

const siblingDbPath = path.resolve(
  import.meta.dirname,
  "..",
  "..",
  "..",
  SIBLING_DIR,
  "src",
  "lib",
  "db.ts",
);
const hasSibling = fs.existsSync(siblingDbPath);

interface DbModule {
  listEntries: (
    userId: string,
    kind?: string,
  ) => Promise<{ id: string; title: string }[] | null>;
}

async function freshDb(): Promise<PGlite> {
  if (holder.pg) await holder.pg.close();
  holder.pg = new PGlite();
  vi.resetModules();
  process.env.DATABASE_URL = "pglite://contract-test";
  return holder.pg;
}

async function migrateOwn(): Promise<DbModule> {
  const db = (await import("./db")) as DbModule;
  await db.listEntries("contract-probe");
  return db;
}

async function migrateSibling(): Promise<DbModule> {
  const db = (await import(siblingDbPath)) as DbModule;
  await db.listEntries("contract-probe");
  return db;
}

async function tableColumns(
  pg: PGlite,
  table: string,
): Promise<string[]> {
  const res = await pg.query<{ column_name: string }>(
    "SELECT column_name FROM information_schema.columns WHERE table_name = $1",
    [table],
  );
  return res.rows.map((r) => r.column_name);
}

async function tableExists(pg: PGlite, table: string): Promise<boolean> {
  const res = await pg.query<{ ok: string }>(
    "SELECT to_regclass($1)::text AS ok",
    [`public.${table}`],
  );
  return res.rows[0]?.ok !== null;
}

afterEach(async () => {
  if (holder.pg) await holder.pg.close();
  holder.pg = null;
  vi.resetModules();
  delete process.env.DATABASE_URL;
});

describe("shared-db contract: own migrations", () => {
  it("accepts every contracted kind", async () => {
    const pg = await freshDb();
    await migrateOwn();
    for (const kind of CONTRACT_KINDS) {
      await pg.query(
        "INSERT INTO entries (id, user_id, kind, title) VALUES ($1, 'u', $2, $3)",
        [`probe-${kind}`, kind, kind],
      );
    }
    const res = await pg.query<{ count: string }>(
      "SELECT COUNT(*) AS count FROM entries",
    );
    expect(Number(res.rows[0].count)).toBe(CONTRACT_KINDS.length);
  });

  it("has every contracted column", async () => {
    const pg = await freshDb();
    await migrateOwn();
    const cols = await tableColumns(pg, "entries");
    for (const col of CONTRACT_COLUMNS) expect(cols).toContain(col);
  });

  it("creates this app's token table", async () => {
    const pg = await freshDb();
    await migrateOwn();
    await expect(tableExists(pg, OWN_TOKENS_TABLE)).resolves.toBe(true);
  });

  it("migration source stays additive-only", async () => {
    const src = fs.readFileSync(
      path.resolve(import.meta.dirname, "db.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/DROP\s+(COLUMN|TABLE)/i);
  });
});

describe.runIf(hasSibling)("shared-db contract: cross-app convergence", () => {
  const seedAllKinds = async (pg: PGlite) => {
    for (const kind of CONTRACT_KINDS) {
      await pg.query(
        "INSERT INTO entries (id, user_id, kind, title) VALUES ($1, 'shared-user', $2, $3)",
        [`seed-${kind}`, kind, kind],
      );
    }
  };

  const expectConverged = async (pg: PGlite) => {
    const cols = await tableColumns(pg, "entries");
    for (const col of CONTRACT_COLUMNS) expect(cols).toContain(col);
    await expect(tableExists(pg, "trakt_tokens")).resolves.toBe(true);
    await expect(tableExists(pg, "anilist_tokens")).resolves.toBe(true);
    const res = await pg.query<{ id: string; kind: string }>(
      "SELECT id, kind FROM entries ORDER BY id",
    );
    expect(res.rows.map((r) => `${r.id}:${r.kind}`)).toEqual(
      CONTRACT_KINDS.map((k) => `seed-${k}:${k}`),
    );
  };

  it("sibling-first, then own: converges with data intact", async () => {
    const pg = await freshDb();
    await migrateSibling();
    await seedAllKinds(pg);
    await migrateOwn();
    // Re-run both to prove idempotence on a populated DB.
    await migrateSibling();
    await migrateOwn();
    await expectConverged(pg);
  });

  it("own-first, then sibling: converges with data intact", async () => {
    const pg = await freshDb();
    await migrateOwn();
    await seedAllKinds(pg);
    await migrateSibling();
    await migrateOwn();
    await migrateSibling();
    await expectConverged(pg);
  });
});
