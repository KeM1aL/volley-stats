import { describe, expect, it } from "vitest";
import { allowedOrigins, corsHeaders, preflight, withCors } from "@/lib/server/cors";

describe("cors", () => {
  const allowed = ["http://localhost:3200", "capacitor://localhost"];
  it("parses the allowlist", () => {
    expect(allowedOrigins(" http://localhost:3200 , capacitor://localhost,")).toEqual(allowed);
    expect(allowedOrigins(undefined)).toEqual([]);
  });
  it("answers allowed origins only, always varying on Origin", () => {
    expect(corsHeaders("http://localhost:3200", allowed)).toMatchObject({
      "Access-Control-Allow-Origin": "http://localhost:3200",
      "Access-Control-Allow-Headers": "Authorization, Content-Type, If-None-Match",
      "Access-Control-Expose-Headers": "ETag, Content-Disposition",
      Vary: "Origin",
    });
    expect(corsHeaders("https://evil.example", allowed)).toEqual({ Vary: "Origin" });
    expect(corsHeaders(null, allowed)).toEqual({ Vary: "Origin" });
  });
  it("adds the headers to responses and preflights", () => {
    process.env.API_CORS_ORIGINS = "http://localhost:3200";
    const request = new Request("http://localhost:3100/api/v1/x", { headers: { origin: "http://localhost:3200" } });
    expect(withCors(request, Response.json({ ok: true })).headers.get("access-control-allow-origin")).toBe("http://localhost:3200");
    const answer = preflight(request);
    expect(answer.status).toBe(204);
    expect(answer.headers.get("access-control-allow-methods")).toBe("GET, POST, DELETE, OPTIONS");
  });
});
