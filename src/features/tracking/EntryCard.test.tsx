import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EntryCard, statusLabel } from "./EntryCard";
import type { Entry } from "@/lib/db";

const base: Entry = {
  id: "1",
  userId: "u",
  kind: "anime",
  title: "Naruto",
  coverUrl: null,
  status: "watching",
  progress: 5,
  total: 220,
  score: 8,
  notes: "great",
  anilistId: 20,
  updatedAt: new Date().toISOString(),
};

describe("statusLabel", () => {
  it("maps known statuses and passes through unknown", () => {
    expect(statusLabel("watching")).toBe("Watching");
    expect(statusLabel("plan_to_read")).toBe("Plan to read");
    expect(statusLabel("weird" as never)).toBe("weird");
  });
});

describe("EntryCard", () => {
  it("renders title, progress, score and AniList link", () => {
    render(<EntryCard entry={base} onEdit={() => {}} onDelete={() => {}} />);
    expect(screen.getByText("Naruto")).toBeInTheDocument();
    expect(screen.getByText(/5.*220/)).toBeInTheDocument();
    expect(screen.getByText(/8\/10/)).toBeInTheDocument();
    expect(screen.getByText("AniList ↗")).toHaveAttribute(
      "href",
      "https://anilist.co/anime/20",
    );
  });

  it("calls onEdit and onDelete", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(<EntryCard entry={base} onEdit={onEdit} onDelete={onDelete} />);
    await user.click(screen.getByText("Edit"));
    await user.click(screen.getByText("Remove"));
    expect(onEdit).toHaveBeenCalledWith(base);
    expect(onDelete).toHaveBeenCalledWith("1");
  });
});
