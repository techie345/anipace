import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isDbConfigured, listEntries } from "@/lib/db";
import { userKey } from "@/lib/current-user";
import {
  exportFilename,
  serializeExport,
  type ExportFormat,
} from "@/features/export/export-entries";

// GET /api/entries/export?format=json|csv — download this app's list as a
// file (DB mode; 503 so the client falls back to localStorage export).
export async function GET(req: Request) {
  if (!isDbConfigured())
    return NextResponse.json({ fallback: true }, { status: 503 });
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const format: ExportFormat =
    new URL(req.url).searchParams.get("format") === "csv" ? "csv" : "json";
  const uid = userKey(session);
  const [anime, manga] = await Promise.all([
    listEntries(uid, "anime"),
    listEntries(uid, "manga"),
  ]);
  const { body, contentType } = serializeExport(
    [...(anime ?? []), ...(manga ?? [])],
    format,
  );
  return new NextResponse(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${exportFilename(format)}"`,
    },
  });
}
