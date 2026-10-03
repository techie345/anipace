import type { Entry, EntryStatus } from "@/lib/db";

export const STATUSES: { value: EntryStatus; label: string }[] = [
  { value: "watching", label: "Watching" },
  { value: "reading", label: "Reading" },
  { value: "completed", label: "Completed" },
  { value: "on_hold", label: "On hold" },
  { value: "dropped", label: "Dropped" },
  { value: "plan_to_watch", label: "Plan to watch" },
  { value: "plan_to_read", label: "Plan to read" },
];

export function statusLabel(s: EntryStatus) {
  return STATUSES.find((x) => x.value === s)?.label ?? s;
}

export function EntryCard({
  entry,
  onEdit,
  onDelete,
}: {
  entry: Entry;
  onEdit: (e: Entry) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <li className="flex gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
      {entry.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={entry.coverUrl}
          alt=""
          className="h-24 w-16 shrink-0 rounded object-cover"
        />
      ) : (
        <div className="flex h-24 w-16 shrink-0 items-center justify-center rounded bg-zinc-800 text-xs text-zinc-500">
          No art
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate font-medium">{entry.title}</h3>
          <span className="shrink-0 rounded-full bg-indigo-950 px-2 py-0.5 text-xs text-indigo-300">
            {statusLabel(entry.status)}
          </span>
        </div>
        <p className="mt-1 text-sm text-zinc-400">
          {entry.progress}
          {entry.total != null ? ` / ${entry.total}` : ""} eps
          {entry.score != null ? ` · ★ ${entry.score}/10` : ""}
        </p>
        {entry.notes && (
          <p className="mt-1 truncate text-sm text-zinc-500">{entry.notes}</p>
        )}
        <div className="mt-2 flex gap-2 text-xs">
          <button
            onClick={() => onEdit(entry)}
            className="rounded bg-zinc-800 px-2 py-1 hover:bg-zinc-700"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(entry.id)}
            className="rounded bg-zinc-800 px-2 py-1 text-red-300 hover:bg-zinc-700"
          >
            Remove
          </button>
          {entry.anilistId && (
            <a
              href={`https://anilist.co/${entry.kind === "anime" ? "anime" : "manga"}/${entry.anilistId}`}
              target="_blank"
              rel="noreferrer"
              className="rounded px-2 py-1 text-zinc-400 hover:text-white"
            >
              AniList ↗
            </a>
          )}
        </div>
      </div>
    </li>
  );
}
