import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { findSecrets, forbiddenPaths, missingPages } from "../../../scripts/lib/export-check.mjs";

const jwt = (payload: object) =>
  ["eyJhbGciOiJIUzI1NiJ9", Buffer.from(JSON.stringify(payload)).toString("base64url"), "c2lnbmF0dXJlc2lnbmF0dXJl"].join(".");

describe("export check", () => {
  it("lists pages without an index.html", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "out-"));
    fs.mkdirSync(path.join(dir, "teams"), { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), "");
    fs.writeFileSync(path.join(dir, "teams", "index.html"), "");
    expect(missingPages(dir, ["/", "/teams", "/matches/live"])).toEqual(["/matches/live"]);
  });
  it("flags dynamic segments, the service worker and API routes", () => {
    expect(forbiddenPaths(["matches/[id]/live/index.html", "serwist/sw.js", "sw.js", "api/v1/x", "teams/index.html"])).toEqual([
      "matches/[id]/live/index.html", "serwist/sw.js", "sw.js", "api/v1/x",
    ]);
  });
  it("finds service-role JWTs and secret keys, not anon keys or the bare word", () => {
    const service = jwt({ role: "service_role", iss: "supabase" });
    const anon = jwt({ role: "anon", iss: "supabase" });
    expect(findSecrets(`a ${service} b`)).toHaveLength(1);
    expect(findSecrets(`a ${anon} b role:"service_role"`)).toEqual([]);
    expect(findSecrets("x sb_secret_abcdefghijklmnop y")).toHaveLength(1);
    expect(findSecrets("x my-actual-key y", { serviceKey: "my-actual-key" })).toHaveLength(1);
  });
});
