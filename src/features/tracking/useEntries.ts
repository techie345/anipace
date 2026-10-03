"use client";

import { useCallback, useEffect, useState } from "react";
import type { Entry, MediaKind } from "@/lib/db";

const KEY = "anipace:entries:v1";

function readLocal(): Entry[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as Entry[];
  } catch {
    return [];
  }
}

function writeLocal(entries: Entry[]) {
  localStorage.setItem(KEY, JSON.stringify(entries));
}

const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, init);
  if (res.status === 503) return null; // no DB → local fallback
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return (await res.json()) as unknown;
}

// Dual storage: Vercel DB (Neon) when configured, else browser localStorage.
// The /api/entries routes answer 503 without a DATABASE_URL, and we fall back.
export function useEntries(kind?: MediaKind) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [mode, setMode] = useState<"db" | "local" | "loading">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await api(
        `/api/entries${kind ? `?kind=${kind}` : ""}`,
      ).catch(() => null);
      if (cancelled) return;
      if (data && typeof data === "object" && "entries" in data) {
        setEntries((data as { entries: Entry[] }).entries);
        setMode("db");
      } else {
        const all = readLocal();
        setEntries(kind ? all.filter((e) => e.kind === kind) : all);
        setMode("local");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kind]);

  const save = useCallback(
    async (draft: Omit<Entry, "id" | "userId" | "updatedAt"> & { id?: string }) => {
      if (mode === "db") {
        const data = await api("/api/entries", {
          method: draft.id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        });
        if (data && typeof data === "object" && "entry" in data) {
          const saved = (data as { entry: Entry }).entry;
          setEntries((prev) =>
            prev.some((e) => e.id === saved.id)
              ? prev.map((e) => (e.id === saved.id ? saved : e))
              : [saved, ...prev],
          );
          return;
        }
      }
      // local fallback
      const now = new Date().toISOString();
      setEntries((prev) => {
        const next = draft.id
          ? prev.map((e) =>
              e.id === draft.id ? { ...e, ...draft, id: e.id, updatedAt: now } as Entry : e,
            )
          : [
              {
                ...draft,
                id: uid(),
                userId: "local-user",
                updatedAt: now,
              } as Entry,
              ...prev,
            ];
        writeLocal(
          // merge with entries of the other kind already in storage
          [...next, ...readLocal().filter((e) => !next.some((n) => n.id === e.id))],
        );
        return next;
      });
    },
    [mode],
  );

  const remove = useCallback(
    async (id: string) => {
      if (mode === "db") {
        await api(`/api/entries?id=${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
      }
      setEntries((prev) => {
        const next = prev.filter((e) => e.id !== id);
        if (mode !== "db") {
          const others = readLocal().filter(
            (e) => e.id !== id && (kind ? e.kind !== kind : false),
          );
          writeLocal([...next, ...others]);
        }
        return next;
      });
    },
    [mode, kind],
  );

  const replaceAll = useCallback((items: Entry[]) => {
    setEntries(items);
    writeLocal(items);
  }, []);

  return { entries, mode, save, remove, replaceAll };
}
