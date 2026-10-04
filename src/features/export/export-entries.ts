import type { Entry, MediaKind } from "@/lib/db";

/** Kinds belonging to this app. The shared table also holds the sibling
 *  app's rows — exports must never include those. */
export const OWN_KINDS: readonly MediaKind[] = ["anime", "manga"];

export type ExportFormat = "json" | "csv";

export function exportFilename(format: ExportFormat, date = new Date()): string {
  return `anipace-export-${date.toISOString().slice(0, 10)}.${format}`;
}

interface ExportRow {
  title: string;
  kind: string;
  status: string;
  progress: number;
  total: number | null;
  score: number | null;
  notes: string | null;
  anilist_id: number | null;
  updated_at: string;
}

const CSV_COLUMNS: Array<keyof ExportRow> = [
  "title",
  "kind",
  "status",
  "progress",
  "total",
  "score",
  "notes",
  "anilist_id",
  "updated_at",
];

export function toExportRows(entries: Entry[]): ExportRow[] {
  return entries
    .filter((e) => (OWN_KINDS as readonly string[]).includes(e.kind))
    .map((e) => ({
      title: e.title,
      kind: e.kind,
      status: e.status,
      progress: e.progress,
      total: e.total,
      score: e.score,
      notes: e.notes,
      anilist_id: e.anilistId,
      updated_at: e.updatedAt,
    }));
}

export function toExportJson(entries: Entry[]): string {
  return JSON.stringify(toExportRows(entries), null, 2);
}

function csvCell(value: string | number | null): string {
  if (value == null) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toExportCsv(entries: Entry[]): string {
  const lines = [CSV_COLUMNS.join(",")];
  for (const row of toExportRows(entries)) {
    lines.push(CSV_COLUMNS.map((c) => csvCell(row[c])).join(","));
  }
  return lines.join("\n") + "\n";
}

export function serializeExport(
  entries: Entry[],
  format: ExportFormat,
): { body: string; contentType: string } {
  return format === "csv"
    ? { body: toExportCsv(entries), contentType: "text/csv; charset=utf-8" }
    : { body: toExportJson(entries), contentType: "application/json" };
}
