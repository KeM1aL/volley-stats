import { describe, expect, it } from "vitest";
import { ScorerRpcError, claimMatchScorer, getMatchScorer, isClaimForbidden } from "@/lib/rxdb/sync/scorer-claim";
import { createFakeServer } from "../helpers/server";
import { seedServerMatch, seedTeams } from "../helpers/fixtures";

function setup() {
  const server = createFakeServer();
  seedTeams(server);
  const matchId = seedServerMatch(server);
  return { server, matchId };
}

describe("scorer RPC client", () => {
  it("claims a free match", async () => {
    const { server, matchId } = setup();
    const result = await claimMatchScorer(server.client({ userName: "Alex" }), {
      matchId,
      deviceId: "device-a",
      label: "Chrome · Android",
      force: false,
    });
    expect(result.claimed).toBe(true);
    expect(result.holder).toMatchObject({ deviceId: "device-a", name: "Alex", deviceLabel: "Chrome · Android" });
  });

  it("reports the device that holds the match", async () => {
    const { server, matchId } = setup();
    server.setScorer(matchId, { deviceId: "device-b", name: "Sam", label: "iPad" });
    const result = await claimMatchScorer(server.client(), { matchId, deviceId: "device-a", label: "x", force: false });
    expect(result.claimed).toBe(false);
    expect(result.holder).toMatchObject({ deviceId: "device-b", name: "Sam", deviceLabel: "iPad" });
  });

  it("takes the match over when forced", async () => {
    const { server, matchId } = setup();
    server.setScorer(matchId, { deviceId: "device-b" });
    const result = await claimMatchScorer(server.client(), { matchId, deviceId: "device-a", label: "x", force: true });
    expect(result.claimed).toBe(true);
    expect(server.row("matches", matchId)!.scorer_device_id).toBe("device-a");
  });

  it("reads the holder and the last activity", async () => {
    const { server, matchId } = setup();
    server.setScorer(matchId, { deviceId: "device-b" });
    const holder = await getMatchScorer(server.client(), matchId, "device-a");
    expect(holder.deviceId).toBe("device-b");
    expect(holder.lastActivityAt).not.toBeNull();
  });

  it("throws a ScorerRpcError with status 0 when offline", async () => {
    const { server, matchId } = setup();
    server.offline = true;
    await expect(claimMatchScorer(server.client(), { matchId, deviceId: "d", label: "x", force: false })).rejects.toMatchObject({
      name: "ScorerRpcError",
      status: 0,
    });
  });
});

describe("isClaimForbidden", () => {
  it.each([
    [new ScorerRpcError("P0002", "match_not_found", 400), true],
    [new ScorerRpcError("42501", "permission denied", 403), true],
    [new ScorerRpcError("", "TypeError: Failed to fetch", 0), false],
    [new ScorerRpcError("42501", "permission denied", 401), false], // anon key: an auth problem, not a refusal
    [new ScorerRpcError("PGRST303", "JWT expired", 401), false],
    [new ScorerRpcError("", "Service Unavailable", 503), false],
    [new Error("boom"), false],
  ])("%o → %s", (error, forbidden) => {
    expect(isClaimForbidden(error)).toBe(forbidden);
  });

  it("is what a non-existent (or unwritable) match gives", async () => {
    const { server } = setup();
    const error = await claimMatchScorer(server.client(), {
      matchId: "20000000-0000-4000-8000-0000000000ff",
      deviceId: "device-a",
      label: "x",
      force: false,
    }).catch((caught: unknown) => caught);
    expect(isClaimForbidden(error)).toBe(true);
  });
});
