import { describe, expect, it } from "vitest";
import { apiUrl } from "@/lib/api-url";

describe("apiUrl", () => {
  it("keeps same-origin paths on web", () => {
    expect(apiUrl("/api/v1/matches/1/report", "")).toBe("/api/v1/matches/1/report");
  });
  it("prefixes the API origin on mobile, without a double slash", () => {
    expect(apiUrl("/api/v1/x", "https://volley.example")).toBe("https://volley.example/api/v1/x");
    expect(apiUrl("/api/v1/x", "https://volley.example/")).toBe("https://volley.example/api/v1/x");
  });
  it("rejects paths that are not absolute", () => {
    expect(() => apiUrl("api/v1/x", "")).toThrow();
  });
});
