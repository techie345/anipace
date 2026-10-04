"use client";

import { useState } from "react";
import {
  exportFilename,
  serializeExport,
  type ExportFormat,
} from "./export-entries";
import type { Entry } from "@/lib/db";

const LOCAL_KEY = "anipace:entries:v1";

function triggerDownload(body: string, filename: string, contentType: string) {
  const url = URL.createObjectURL(new Blob([body], { type: contentType }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function filenameFromHeader(res: Response, format: ExportFormat): string {
  const m = /filename="([^"]+)"/.exec(
    res.headers.get("Content-Disposition") ?? "",
  );
  return m?.[1] ?? exportFilename(format);
}

export default function ExportButtons() {
  const [busy, setBusy] = useState<ExportFormat | null>(null);

  async function download(format: ExportFormat) {
    setBusy(format);
    try {
      // DB mode: server builds the file (kind-scoped). 503 → no database,
      // fall back to this browser's localStorage.
      const res = await fetch(`/api/entries/export?format=${format}`);
      if (res.ok) {
        triggerDownload(
          await res.text(),
          filenameFromHeader(res, format),
          res.headers.get("Content-Type") ?? "application/octet-stream",
        );
        return;
      }
      const raw = localStorage.getItem(LOCAL_KEY) ?? "[]";
      const { body, contentType } = serializeExport(
        JSON.parse(raw) as Entry[],
        format,
      );
      triggerDownload(body, exportFilename(format), contentType);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {(["json", "csv"] as const).map((format) => (
        <button
          key={format}
          onClick={() => void download(format)}
          disabled={busy !== null}
          className="rounded-md bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700 disabled:opacity-50"
        >
          {busy === format
            ? "Preparing…"
            : `Download .${format.toUpperCase()}`}
        </button>
      ))}
    </div>
  );
}
