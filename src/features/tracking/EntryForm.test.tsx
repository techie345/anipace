import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EntryForm } from "./EntryForm";

describe("EntryForm", () => {
  it("submits a trimmed title draft", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <EntryForm kind="anime" onSave={onSave} onCancel={() => {}} />,
    );
    await user.type(screen.getByPlaceholderText("Title"), "  Bleach  ");
    await user.click(screen.getByText("Add"));
    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave.mock.calls[0][0]).toMatchObject({
      kind: "anime",
      title: "Bleach",
      status: "plan_to_watch",
    });
  });

  it("does not submit with a blank title", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <EntryForm kind="manga" onSave={onSave} onCancel={() => {}} />,
    );
    await user.click(screen.getByText("Add"));
    expect(onSave).not.toHaveBeenCalled();
  });
});
