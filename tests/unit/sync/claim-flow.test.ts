import { describe, expect, it } from "vitest";
import { claimBecameHeld, claimFollowUp, offlineConfirmFollowUp } from "@/lib/rxdb/sync/claim-flow";

describe("claimFollowUp", () => {
  it("reloads only when the claim succeeded and the match was refreshed", () => {
    expect(claimFollowUp(true, true)).toBe("reload");
  });

  it("keeps scoring blocked when the claim succeeded but the refresh failed or timed out", () => {
    expect(claimFollowUp(true, false)).toBe("refresh-failed");
  });

  it("leaves scoring where it is when the server named another device", () => {
    expect(claimFollowUp(false, false)).toBe("not-claimed");
    expect(claimFollowUp(false, true)).toBe("not-claimed");
  });
});

describe("offlineConfirmFollowUp", () => {
  it("explains that taking scoring back needs a connection when the claim is lost", () => {
    expect(offlineConfirmFollowUp("lost")).toBe("needs-connection");
  });

  it("scores offline otherwise", () => {
    for (const claim of ["held", "pending-force", null, undefined] as const) {
      expect(offlineConfirmFollowUp(claim)).toBe("scoring-offline");
    }
  });
});

describe("claimBecameHeld", () => {
  it("is true only for the lost to held transition", () => {
    expect(claimBecameHeld("lost", "held")).toBe(true);
    expect(claimBecameHeld(undefined, "held")).toBe(false);
    expect(claimBecameHeld("held", "lost")).toBe(false);
    expect(claimBecameHeld("lost", "lost")).toBe(false);
    expect(claimBecameHeld("lost", undefined)).toBe(false);
    expect(claimBecameHeld("pending-force", "held")).toBe(false);
  });
});
