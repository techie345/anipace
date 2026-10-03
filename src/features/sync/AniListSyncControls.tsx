"use client";

import { useEffect, useState } from "react";

export default function AniListSyncControls() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/anilist/status")
      .then((r) => r.json())
      .then((j) => {
        setConnected(Boolean(j.connected));
        setReason(typeof j.reason === "string" ? j.reason : null);
      })
      .catch(() => setConnected(false));
  }, []);

  async function runSync(direction: "pull" | "push" | "both") {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/anilist/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction }),
      });
      const json = (await res.json()) as {
        pulled?: number;
        pushed?: number;
        skipped?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Sync failed");
      const bits = [
        `pulled ${json.pulled ?? 0}`,
        `pushed ${json.pushed ?? 0}`,
      ];
      if (json.skipped) bits.push(`skipped ${json.skipped} already in sync`);
      setMsg(`Synced — ${bits.join(", ")}.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  if (connected === null)
    return <p className="text-sm text-zinc-500">Checking AniList…</p>;

  if (!connected)
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="font-medium">AniList 2-way sync</h2>
        <p className="mt-1 text-sm text-zinc-400">
          {reason === "no-db"
            ? "Connect Neon Postgres first — tokens need a database."
            : reason === "misconfigured"
              ? "Set ANILIST_CLIENT_ID / ANILIST_CLIENT_SECRET (anilist.co/settings/developer)."
              : "Connect your AniList account to push and pull list changes."}
        </p>
        <a
          href="/api/anilist/auth"
          className="mt-3 inline-block rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium hover:bg-indigo-500"
        >
          Connect AniList
        </a>
        {msg && <p className="mt-2 text-sm text-red-400">{msg}</p>}
      </div>
    );

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <h2 className="font-medium">AniList 2-way sync</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Pull your AniList lists down, push local progress up, or do both.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => void runSync("pull")}
          disabled={busy}
          className="rounded-md bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700 disabled:opacity-50"
        >
          Pull from AniList
        </button>
        <button
          onClick={() => void runSync("push")}
          disabled={busy}
          className="rounded-md bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700 disabled:opacity-50"
        >
          Push to AniList
        </button>
        <button
          onClick={() => void runSync("both")}
          disabled={busy}
          className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
        >
          Sync both ways
        </button>
      </div>
      {busy && <p className="mt-2 text-sm text-zinc-500">Syncing…</p>}
      {msg && <p className="mt-2 text-sm text-green-400">{msg}</p>}
    </div>
  );
}
