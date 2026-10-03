import { describe, it, expect } from "vitest";
import {
  fromAniListScore,
  fromAniListStatus,
  retryAfterMs,
  toAniListScore,
  toAniListStatus,
  buildAuthorizeUrl,
} from "./anilist-sync";

describe("status mapping", () => {
  it("maps local → AniList", () => {
    expect(toAniListStatus("watching", "anime")).toBe("CURRENT");
    expect(toAniListStatus("reading", "manga")).toBe("CURRENT");
    expect(toAniListStatus("plan_to_watch", "anime")).toBe("PLANNING");
    expect(toAniListStatus("plan_to_read", "manga")).toBe("PLANNING");
    expect(toAniListStatus("completed", "anime")).toBe("COMPLETED");
    expect(toAniListStatus("on_hold", "manga")).toBe("PAUSED");
    expect(toAniListStatus("dropped", "anime")).toBe("DROPPED");
  });

  it("maps AniList → local with kind awareness", () => {
    expect(fromAniListStatus("CURRENT", "anime")).toBe("watching");
    expect(fromAniListStatus("CURRENT", "manga")).toBe("reading");
    expect(fromAniListStatus("PLANNING", "manga")).toBe("plan_to_read");
    expect(fromAniListStatus("PAUSED", "anime")).toBe("on_hold");
    expect(fromAniListStatus("UNKNOWN", "anime")).toBe("plan_to_watch");
  });
});

describe("score mapping", () => {
  it("converts local 0-10 → AniList raw 0-100", () => {
    expect(toAniListScore(8)).toBe(80);
    expect(toAniListScore(null)).toBeNull();
  });

  it("converts AniList formats → local 0-10", () => {
    expect(fromAniListScore(80, "POINT_100")).toBe(8);
    expect(fromAniListScore(8.5, "POINT_10_DECIMAL")).toBe(9);
    expect(fromAniListScore(4, "POINT_5")).toBe(8);
    expect(fromAniListScore(3, "POINT_3")).toBe(10);
    expect(fromAniListScore(0, "POINT_100")).toBeNull();
    expect(fromAniListScore(null, "POINT_100")).toBeNull();
  });
});

describe("retryAfterMs", () => {
  it("parses seconds, caps, rejects garbage", () => {
    expect(retryAfterMs("2")).toBe(2000);
    expect(retryAfterMs("60", 15000)).toBe(15000);
    expect(retryAfterMs(null)).toBeNull();
    expect(retryAfterMs("soon")).toBeNull();
    expect(retryAfterMs("-1")).toBeNull();
  });
});

describe("buildAuthorizeUrl", () => {
  it("includes client, redirect and response_type", () => {
    const url = new URL(
      buildAuthorizeUrl({ clientId: "123", redirectUri: "https://x/cb" }),
    );
    expect(url.searchParams.get("client_id")).toBe("123");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("redirect_uri")).toBe("https://x/cb");
  });
});
