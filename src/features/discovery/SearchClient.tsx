"use client";

import { useState } from "react";
import { useEntries } from "@/features/tracking/useEntries";
import type { Entry, MediaKind } from "@/lib/db";

interface SearchResult {
  anilistId: number;
  title: string;
  coverUrl: string | null;
  total: number | null;
  score: number | null;
  description: string | null;
  genres: string[];
  format: string | null;
  status: string | null;
  year: number | null;
  siteUrl: string | null;
}

export default function SearchClient() {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<MediaKind>("anime");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const { save, replaceAll, entries } = useEntries();

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/anilist/search?q=${encodeURIComponent(q)}&type=${tab === "anime" ? "ANIME" : "MANGA"}`,
      );
      const json = (await res.json()) as { results?: SearchResult[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Search failed");
      setResults(json.results ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setBusy(false);
    }
  }

  function addResult(r: SearchResult) {
    void save({
      kind: tab,
      title: r.title,
      coverUrl: r.coverUrl,
      status: tab === "anime" ? "plan_to_watch" : "plan_to_read",
      progress: 0,
      total: r.total,
      score: null,
      notes: null,
      anilistId: r.anilistId,
    });
  }

  async function runImport(e: React.FormEvent, kind: MediaKind) {
    e.preventDefault();
    if (!userName.trim()) return;
    setBusy(true);
    setImportMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/anilist/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userName: userName.trim(), kind }),
      });
      const json = (await res.json()) as {
        entries?: (Omit<Entry, "id" | "userId" | "updatedAt"> & { id?: string })[];
        stored?: boolean;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Import failed");
      const imported = json.entries ?? [];
      if (json.stored) {
        setImportMsg(`Imported ${imported.length} ${kind} titles into the database.`);
      } else {
        // localStorage mode: merge imported entries in
        const now = new Date().toISOString();
        const existingIds = new Set(entries.map((x) => x.anilistId));
        const fresh: Entry[] = imported
          .filter((x) => x.anilistId == null || !existingIds.has(x.anilistId))
          .map((x, i) => ({
            ...x,
            id: `import-${Date.now()}-${i}`,
            userId: "local-user",
            updatedAt: now,
          }));
        replaceAll([...fresh, ...entries]);
        setImportMsg(`Imported ${fresh.length} ${kind} titles into this browser.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Search AniList</h1>
        <div className="mt-3 flex gap-2">
          {(["anime", "manga"] as MediaKind[]).map((k) => (
            <button
              key={k}
              onClick={() => {
                setTab(k);
                setResults([]);
              }}
              className={`rounded-md px-3 py-1.5 text-sm capitalize ${tab === k ? "bg-indigo-600" : "bg-zinc-800 hover:bg-zinc-700"}`}
            >
              {k}
            </button>
          ))}
        </div>
        <form onSubmit={runSearch} className="mt-3 flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${tab}…`}
            className="flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
          >
            Search
          </button>
        </form>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {busy && <p className="text-sm text-zinc-500">Working…</p>}

      {results.length > 0 && (
        <ul className="grid gap-3 md:grid-cols-2">
          {results.map((r) => (
            <li
              key={r.anilistId}
              className="flex gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-3"
            >
              {r.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.coverUrl} alt="" className="h-24 w-16 shrink-0 rounded object-cover" />
              ) : (
                <div className="flex h-24 w-16 shrink-0 items-center justify-center rounded bg-zinc-800 text-xs text-zinc-500">
                  No art
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-medium">{r.title}</h3>
                <p className="text-sm text-zinc-400">
                  {[r.year, r.format, r.status].filter(Boolean).join(" · ") ||
                    "Details unavailable"}
                </p>
                <p className="text-sm text-zinc-400">
                  {r.total ? `${r.total} eps` : "Ongoing/unknown"}
                  {r.score != null ? ` · ★ ${r.score}/10` : ""}
                </p>
                {r.genres.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {r.genres.slice(0, 3).map((g) => (
                      <span
                        key={g}
                        className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                )}
                {r.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-zinc-500">
                    {r.description}
                  </p>
                )}
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => addResult(r)}
                    className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium hover:bg-indigo-500"
                  >
                    + Add to my {tab} list
                  </button>
                  {r.siteUrl && (
                    <a
                      href={r.siteUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded px-2 py-1 text-xs text-zinc-400 hover:text-white"
                    >
                      AniList ↗
                    </a>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="font-medium">Import from AniList</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Enter your public AniList username to pull in your existing lists.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="AniList username"
            className="flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2"
          />
          <div className="flex gap-2">
            <button
              onClick={(e) => void runImport(e, "anime")}
              disabled={busy}
              className="rounded-md bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700 disabled:opacity-50"
            >
              Import anime
            </button>
            <button
              onClick={(e) => void runImport(e, "manga")}
              disabled={busy}
              className="rounded-md bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700 disabled:opacity-50"
            >
              Import manga
            </button>
          </div>
        </div>
        {importMsg && <p className="mt-2 text-sm text-green-400">{importMsg}</p>}
      </div>
    </div>
  );
}
