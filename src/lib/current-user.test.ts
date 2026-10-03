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

  it("merges providers sharing an email regardless of case", () => {
    const fromGithub = userKey({ user: { email: "you@mail.com", name: "gh-handle" } });
    const fromDiscord = userKey({ user: { email: "YOU@mail.com", name: "dc-handle" } });
    expect(fromDiscord).toBe(fromGithub);
  });
});
