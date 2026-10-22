import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { LEGACY_ROUTE_REDIRECTS } from "@/lib/routes";

describe("next.config.js redirects", () => {
  it("match lib/routes.ts", async () => {
    const config = createRequire(import.meta.url)("../../../next.config.js");
    const redirects = await config.redirects();
    expect(redirects).toEqual(LEGACY_ROUTE_REDIRECTS.map((r) => ({ ...r, permanent: true })));
  });
});
