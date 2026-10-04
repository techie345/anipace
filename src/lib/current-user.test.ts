import { describe, it, expect } from "vitest";
import { canonicalEmail, userKey } from "./current-user";

describe("canonicalEmail", () => {
  it("trims and lowercases", () => {
    expect(canonicalEmail("  You@Mail.COM ")).toBe("you@mail.com");
  });
});

describe("userKey", () => {
  it("prefers canonical email over name", () => {
    expect(
      userKey({ user: { email: "You@Mail.com", name: "You" } }),
    ).toBe("you@mail.com");
  });

  it("falls back to name then local-user", () => {
    expect(userKey({ user: { email: null, name: "You" } })).toBe("You");
    expect(userKey({ user: { email: null, name: null } })).toBe("local-user");
    expect(userKey(null)).toBe("local-user");
  });

  it("merges accounts sharing an email regardless of case", () => {
    const first = userKey({ user: { email: "you@mail.com", name: "handle-a" } });
    const second = userKey({ user: { email: "YOU@mail.com", name: "handle-b" } });
    expect(second).toBe(first);
  });
});
