import { describe, expect, it } from "vitest";
import { createFakeServer } from "../helpers/server";
import { aSet, seedServerMatch, seedTeams } from "../helpers/fixtures";

describe("fake supabase server", () => {
  it("paginates with the _modified/id checkpoint filter", async () => {
    const server = createFakeServer();
    seedTeams(server);
    const matchId = seedServerMatch(server);
    for (let i = 0; i < 3; i++) server.seed("sets", aSet(matchId, { set_number: i + 1 }));
    const client = server.client();
    const first = await client.from("sets").select("*").order("_modified", { ascending: true }).order("id", { ascending: true }).limit(2);
    expect(first.data).toHaveLength(2);
    const last = first.data[1];
    const next = await client
      .from("sets")
      .select("*")
      .or(`"_modified".gt.${last._modified},and("_modified".eq.${last._modified},"id".gt.${last.id})`)
      .order("_modified", { ascending: true })
      .order("id", { ascending: true })
      .limit(2);
    expect(next.data.map((row: any) => row.set_number)).toEqual([3]);
  });

  it("keeps the device's updated_at when x-device-id is sent and bumps it otherwise", async () => {
    const server = createFakeServer();
    seedTeams(server);
    const matchId = seedServerMatch(server);
    const set = server.seed("sets", aSet(matchId, { updated_at: "2026-01-01T00:00:00.000Z" }));
    const client = server.client();
    await client.from("sets").update({ home_score: 1, updated_at: "2026-01-02T00:00:00.000Z" }).eq("id", set.id).setHeader("x-device-id", "d1");
    expect(server.row("sets", set.id)!.updated_at).toBe("2026-01-02T00:00:00.000Z");
    await client.from("sets").update({ home_score: 2 }).eq("id", set.id);
    expect(server.row("sets", set.id)!.updated_at).not.toBe("2026-01-02T00:00:00.000Z");
  });

  it("reports a missing parent as 23503 naming the referenced table", async () => {
    const server = createFakeServer();
    const response = await server.client().from("sets").insert(aSet("00000000-0000-4000-8000-00000000dead"));
    expect(response.error?.code).toBe("23503");
    expect(response.error?.details).toContain('table "matches"');
  });

  it("rejects writes from a device that is not the match's scorer", async () => {
    const server = createFakeServer();
    seedTeams(server);
    const matchId = seedServerMatch(server);
    server.setScorer(matchId, { deviceId: "device-b" });
    const response = await server.client().from("sets").insert(aSet(matchId)).setHeader("x-device-id", "device-a");
    expect(response.error).toMatchObject({ code: "P0001", message: "scorer_mismatch" });
  });

  it("commits a write whose response is lost", async () => {
    const server = createFakeServer();
    seedTeams(server);
    const matchId = seedServerMatch(server);
    const set = aSet(matchId);
    server.loseNextResponse("sets");
    const response = await server.client().from("sets").insert(set);
    expect(response.status).toBe(0);
    expect(server.row("sets", set.id)).toBeDefined();
  });
});
