import { describe, expect, it } from "vitest";
import { LiveLoadError, liveLoadFailureReason, missingMatchReason } from "@/lib/matches/live-load-failure";

describe("why the live page leaves for the match list", () => {
  it("keeps the reason of a known failure", () => {
    expect(liveLoadFailureReason(new LiveLoadError("missingTeam"))).toBe("missingTeam");
    expect(liveLoadFailureReason(new LiveLoadError("teamNotInMatch"))).toBe("teamNotInMatch");
  });

  it("calls anything unexpected unknown", () => {
    expect(liveLoadFailureReason(new Error("IndexedDB closed"))).toBe("unknown");
    expect(liveLoadFailureReason("boom")).toBe("unknown");
    expect(liveLoadFailureReason(undefined)).toBe("unknown");
  });

  it("explains a match missing on the device by how its download went", () => {
    expect(missingMatchReason({ online: false, synced: false })).toBe("notOnDevice");
    expect(missingMatchReason({ online: true, synced: false })).toBe("notDownloaded");
    expect(missingMatchReason({ online: true, synced: true })).toBe("matchNotFound");
  });
});
