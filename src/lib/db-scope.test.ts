// @vitest-environment node
/**
 * Regression test: the entries table is shared with cinepace, so movie/tv
 * rows sit alongside anime/manga rows for the same user. statsFor() must count
 * only this app's kinds.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import type { NeonQueryFunction } from "@neondatabase/serverless";

const holder = vi.hoisted(() => ({ pg: null as PGlite | null }));

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

afterEach(async () => {
  if (holder.pg) await holder.pg.close();
  holder.pg = null;
  vi.resetModules();
  delete process.env.DATABASE_URL;
});

describe("statsFor with shared-table rows", () => {
  it("counts completed anime/manga only, ignoring movies/tv", async () => {
    holder.pg = new PGlite();
    vi.resetModules();
    process.env.DATABASE_URL = "pglite://scope-test";
    const db = await import("./db");
    await db.listEntries("u"); // trigger ensureSchema() before seeding

    const seed: Array<[string, string, string]> = [
      ["v1", "movie", "completed"],
      ["v2", "movie", "completed"],
      ["v3", "tv", "completed"],
      ["a1", "anime", "completed"],
      ["m1", "manga", "watching"],
    ];
    for (const [id, kind, status] of seed) {
      await holder.pg.query(
        "INSERT INTO entries (id, user_id, kind, title, status) VALUES ($1, 'u', $2, $3, $4)",
        [id, kind, kind, status],
      );
    }

    const stats = await db.statsFor("u");
    expect(stats).toEqual({ anime: 1, manga: 1, completed: 1 });
  });
});
