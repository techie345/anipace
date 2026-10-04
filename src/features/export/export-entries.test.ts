import { describe, it, expect } from "vitest";
import {
  exportFilename,
  serializeExport,
  toExportCsv,
  toExportJson,
} from "./export-entries";
import type { Entry } from "@/lib/db";

function entry(overrides: Partial<Entry> & { id: string }): Entry {
  return {
    userId: "u",
    kind: "anime",
    title: "T",
    coverUrl: null,
    status: "plan_to_watch",
    progress: 0,
    total: null,
    score: null,
    notes: null,
    anilistId: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const movie = entry({
  id: "v1",
  kind: "movie" as unknown as Entry["kind"],
  title: "Should not export",
  status: "completed",
});

const anime = entry({
  id: "a1",
  title: 'Frieren: Beyond "Journey\'s" End, part 1',
  status: "completed",
  progress: 28,
  total: 28,
  score: 10,
  notes: "line1\nline2",
  anilistId: 22223,
});

describe("export serializers", () => {
  it("excludes sibling-app rows from JSON", () => {
    const rows = JSON.parse(toExportJson([movie, anime])) as Array<{
      title: string;
    }>;
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toContain("Frieren");
    expect(rows[0]).not.toHaveProperty("userId");
    expect(rows[0]).not.toHaveProperty("id");
  });

  it("writes a header + escaped CSV rows, excluding sibling rows", () => {
    const csv = toExportCsv([movie, anime]);
    const lines = csv.trimEnd().split("\n");
    expect(lines[0]).toBe(
      "title,kind,status,progress,total,score,notes,anilist_id,updated_at",
    );
    // The multiline note spans two physical lines inside one quoted field.
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain(
      '"Frieren: Beyond ""Journey\'s"" End, part 1"',
    );
    expect(csv).toContain('"line1\nline2"');
    expect(csv).not.toContain("Should not export");
  });

  it("exports an empty list as valid empty JSON/CSV", () => {
    expect(toExportJson([])).toBe("[]");
    expect(toExportCsv([])).toBe(
      "title,kind,status,progress,total,score,notes,anilist_id,updated_at\n",
    );
  });

  it("names files per app and day", () => {
    expect(exportFilename("json", new Date("2026-03-04T00:00Z"))).toBe(
      "anipace-export-2026-03-04.json",
    );
    expect(serializeExport([], "csv").contentType).toContain("text/csv");
  });
});
