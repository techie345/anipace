"use client";

import { useState } from "react";
import type { Entry, EntryStatus, MediaKind } from "@/lib/db";
import { STATUSES } from "./EntryCard";

export function EntryForm({
  kind,
  initial,
  onSave,
  onCancel,
}: {
  kind: MediaKind;
  initial?: Entry | null;
  onSave: (
    draft: Omit<Entry, "id" | "userId" | "updatedAt"> & { id?: string },
  ) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [status, setStatus] = useState<EntryStatus>(
    initial?.status ?? (kind === "anime" ? "plan_to_watch" : "plan_to_read"),
  );
  const [progress, setProgress] = useState(initial?.progress ?? 0);
  const [total, setTotal] = useState(initial?.total?.toString() ?? "");
  const [score, setScore] = useState(initial?.score?.toString() ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  return (
    <form
      className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        onSave({
          id: initial?.id,
          kind,
          title: title.trim(),
          coverUrl: initial?.coverUrl ?? null,
          status,
          progress: Number(progress) || 0,
          total: total === "" ? null : Number(total),
          score: score === "" ? null : Number(score),
          notes: notes || null,
          anilistId: initial?.anilistId ?? null,
        });
      }}
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        required
        className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2"
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="text-xs text-zinc-400">
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as EntryStatus)}
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm text-white"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-zinc-400">
          Progress
          <input
            type="number"
            min={0}
            value={progress}
            onChange={(e) => setProgress(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm text-white"
          />
        </label>
        <label className="text-xs text-zinc-400">
          Total
          <input
            type="number"
            min={0}
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            placeholder="—"
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm text-white"
          />
        </label>
        <label className="text-xs text-zinc-400">
          Score (0–10)
          <input
            type="number"
            min={0}
            max={10}
            value={score}
            onChange={(e) => setScore(e.target.value)}
            placeholder="—"
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm text-white"
          />
        </label>
      </div>
      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500"
        >
          {initial ? "Save" : "Add"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md bg-zinc-800 px-4 py-2 text-sm hover:bg-zinc-700"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
