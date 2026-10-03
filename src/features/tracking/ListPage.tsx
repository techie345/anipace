"use client";

import { useMemo, useState } from "react";
import { useEntries } from "@/features/tracking/useEntries";
import type { Entry, MediaKind } from "@/lib/db";
import { EntryCard } from "./EntryCard";
import { EntryForm } from "./EntryForm";

export default function ListPage({
  kind,
  title,
}: {
  kind: MediaKind;
  title: string;
}) {
  const { entries, mode, save, remove } = useEntries(kind);
  const [editing, setEditing] = useState<Entry | null | "new">(null);
  const [filter, setFilter] = useState("all");

  const filtered = useMemo(
    () =>
      filter === "all" ? entries : entries.filter((e) => e.status === filter),
    [entries, filter],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{title}</h1>
        <span className="text-xs text-zinc-500">
          {mode === "loading"
            ? "…"
            : mode === "db"
              ? "· synced to Vercel DB"
              : "· stored locally in this browser"}
        </span>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="ml-auto rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
        >
          <option value="all">All ({entries.length})</option>
          <option value={kind === "anime" ? "watching" : "reading"}>
            In progress
          </option>
          <option value="completed">Completed</option>
          <option value="on_hold">On hold</option>
          <option value="dropped">Dropped</option>
          <option value={kind === "anime" ? "plan_to_watch" : "plan_to_read"}>
            Plan to {kind === "anime" ? "watch" : "read"}
          </option>
        </select>
        <button
          onClick={() => setEditing("new")}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium hover:bg-indigo-500"
        >
          + Add
        </button>
      </div>

      {editing && (
        <EntryForm
          kind={kind}
          initial={editing === "new" ? null : editing}
          onSave={(d) => {
            void save(d);
            setEditing(null);
          }}
          onCancel={() => setEditing(null)}
        />
      )}

      {mode === "loading" ? (
        <p className="text-zinc-500">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-800 p-8 text-center text-zinc-500">
          Nothing here yet. Add one manually or{" "}
          <a href="/search" className="text-indigo-400 hover:underline">
            search AniList
          </a>
          .
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {filtered.map((e) => (
            <EntryCard
              key={e.id}
              entry={e}
              onEdit={setEditing}
              onDelete={(id) => void remove(id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
