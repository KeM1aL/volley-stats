import { describe, expect, it } from "vitest";
import { createFakeServer } from "../helpers/server";
import { aScorePoint, aSet, anEvent, seedServerMatch, seedTeams } from "../helpers/fixtures";

const MISSING_TEAM = "10000000-0000-4000-8000-0000000000ff";

function setup() {
  const server = createFakeServer();
  seedTeams(server);
  const matchId = seedServerMatch(server);
  return { server, matchId, client: server.client() };
}

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
    const row = server.row("sets", set.id)!;
    expect(row.updated_at).not.toBe("2026-01-02T00:00:00.000Z");
    // The trigger stamps the server time of this very write, which is also the checkpoint.
    expect(row.updated_at).toBe(row._modified);
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

  it("scorer check runs before duplicate-id check (constraint ordering)", async () => {
    const server = createFakeServer();
    seedTeams(server);
    const matchId = seedServerMatch(server);
    const set = aSet(matchId);
    const deviceA = server.client();
    const firstInsert = await deviceA.from("sets").insert(set).setHeader("x-device-id", "device-a");
    expect(firstInsert.status).toBe(201);
    server.setScorer(matchId, { deviceId: "device-b" });
    const secondInsert = await deviceA.from("sets").insert(set).setHeader("x-device-id", "device-a");
    expect(secondInsert.error).toMatchObject({ code: "P0001", message: "scorer_mismatch" });
  });

  describe("team foreign keys", () => {
    it.each([
      ["sets.server_team_id", "sets", (matchId: string) => aSet(matchId, { server_team_id: MISSING_TEAM })],
      ["sets.first_server_team_id", "sets", (matchId: string) => aSet(matchId, { first_server_team_id: MISSING_TEAM })],
      ["events.team_id", "events", (matchId: string) => anEvent(matchId, null, { team_id: MISSING_TEAM })],
    ])("refuses %s pointing to a missing team", async (_name, table, build) => {
      const { client, matchId } = setup();
      const response = await client.from(table).insert(build(matchId));
      expect(response.error?.code).toBe("23503");
      expect(response.error?.details).toContain('table "teams"');
    });

    it.each([["scoring_team_id"], ["action_team_id"]])("refuses score_points.%s pointing to a missing team", async (column) => {
      const { server, client, matchId } = setup();
      const set = server.seed("sets", aSet(matchId));
      const response = await client.from("score_points").insert(aScorePoint(matchId, set.id, 1, { [column]: MISSING_TEAM }));
      expect(response.error?.code).toBe("23503");
      expect(response.error?.details).toContain('table "teams"');
    });

    it("checks on UPDATE only the foreign keys of the columns in the patch", async () => {
      const { server, client, matchId } = setup();
      const set = server.seed("sets", aSet(matchId, { server_team_id: MISSING_TEAM })); // seeded behind the checks
      const harmless = await client.from("sets").update({ home_score: 1 }).eq("id", set.id);
      expect(harmless.error).toBeNull();
      const broken = await client.from("sets").update({ server_team_id: MISSING_TEAM }).eq("id", set.id);
      expect(broken.error?.code).toBe("23503");
    });
  });

  it("updates several rows atomically: one refused row leaves the others untouched", async () => {
    const { server, client, matchId } = setup();
    const first = server.seed("sets", aSet(matchId, { set_number: 1 }));
    const second = server.seed("sets", aSet(matchId, { set_number: 2 }));
    server.denyWrites("sets", (row) => row.set_number === 2);
    const response = await client.from("sets").update({ home_score: 3 }).eq("match_id", matchId).select();
    expect(response.error?.code).toBe("42501");
    expect(server.row("sets", first.id)!.home_score).toBe(0);
    expect(server.row("sets", second.id)!.home_score).toBe(0);
    server.allowWrites("sets");
    const retry = await client.from("sets").update({ home_score: 3 }).eq("match_id", matchId).select();
    expect(retry.data).toHaveLength(2);
    expect(server.row("sets", first.id)!.home_score).toBe(3);
  });

  describe("loseNextResponse", () => {
    it("loses one response by default and `count` when given", async () => {
      const { server, client, matchId } = setup();
      server.loseNextResponse("sets");
      const statuses: number[] = [];
      for (let i = 1; i <= 3; i++) statuses.push((await client.from("sets").insert(aSet(matchId, { set_number: i }))).status);
      expect(statuses).toEqual([0, 201, 201]);

      server.loseNextResponse("sets", 2);
      for (let i = 4; i <= 7; i++) statuses.push((await client.from("sets").insert(aSet(matchId, { set_number: i }))).status);
      expect(statuses.slice(3)).toEqual([0, 0, 201, 201]);
      expect(server.rows("sets")).toHaveLength(7); // every write committed
    });

    it("loses the response of an update too", async () => {
      const { server, client, matchId } = setup();
      const set = server.seed("sets", aSet(matchId));
      server.loseNextResponse("sets");
      const response = await client.from("sets").update({ home_score: 4 }).eq("id", set.id).select();
      expect(response.status).toBe(0);
      expect(server.row("sets", set.id)!.home_score).toBe(4);
    });
  });

  describe("network faults", () => {
    it("answers status 0 while the server is offline", async () => {
      const { server, client, matchId } = setup();
      server.offline = true;
      const response = await client.from("sets").select("*").eq("match_id", matchId);
      expect(response).toMatchObject({ status: 0, data: null });
      expect(response.error?.message).toMatch(/Failed to fetch/);
      server.offline = false;
      expect((await client.from("sets").select("*")).status).toBe(200);
    });

    it("answers status 0 for as many requests as failNext was given faults", async () => {
      const { server, client } = setup();
      server.failNext("network", "timeout");
      expect((await client.from("sets").select("*")).status).toBe(0);
      const second = await client.from("sets").select("*");
      expect(second.status).toBe(0);
      expect(second.error?.code).toBe("20");
      expect((await client.from("sets").select("*")).status).toBe(200);
    });

    it("fails RPCs the same way", async () => {
      const { server, client, matchId } = setup();
      server.offline = true;
      const response = await client.rpc("get_match_scorer", { p_match_id: matchId });
      expect(response.status).toBe(0);
    });
  });

  describe("scorer RPCs", () => {
    const claim = (client: any, matchId: string, deviceId: string, force = false) =>
      client.rpc("claim_match_scorer", { p_match_id: matchId, p_device_id: deviceId, p_label: "Chrome", p_force: force });

    it("grants a free match and records the claimer", async () => {
      const { server, client, matchId } = setup();
      const response = await claim(client, matchId, "device-a");
      expect(response.data).toMatchObject({ claimed: true, scorer_device_id: "device-a", scorer_device_label: "Chrome" });
      expect(server.row("matches", matchId)!.scorer_device_id).toBe("device-a");
    });

    it("lets the holder claim again", async () => {
      const { client, matchId } = setup();
      await claim(client, matchId, "device-a");
      expect((await claim(client, matchId, "device-a")).data.claimed).toBe(true);
    });

    it("reports the holder of a held match without taking it", async () => {
      const { server, client, matchId } = setup();
      server.setScorer(matchId, { deviceId: "device-b", name: "Sam" });
      const response = await claim(client, matchId, "device-a");
      expect(response.data).toMatchObject({ claimed: false, scorer_device_id: "device-b", scorer_name: "Sam" });
      expect(server.row("matches", matchId)!.scorer_device_id).toBe("device-b");
    });

    it("takes a held match over when forced", async () => {
      const { server, client, matchId } = setup();
      server.setScorer(matchId, { deviceId: "device-b" });
      const response = await claim(client, matchId, "device-a", true);
      expect(response.data).toMatchObject({ claimed: true, scorer_device_id: "device-a" });
      expect(server.row("matches", matchId)!.scorer_device_id).toBe("device-a");
    });

    it("get_match_scorer reads the holder and the latest activity without changing anything", async () => {
      const { server, client, matchId } = setup();
      server.setScorer(matchId, { deviceId: "device-b" });
      const set = server.seed("sets", aSet(matchId));
      const response = await client.rpc("get_match_scorer", { p_match_id: matchId });
      expect(response.data).toMatchObject({ scorer_device_id: "device-b" });
      expect(response.data.last_activity_at).toBe(server.row("sets", set.id)!._modified);
      expect(server.row("matches", matchId)!.scorer_device_id).toBe("device-b");
    });

    it("refuses a missing or blank device id with 22023 and changes nothing", async () => {
      const { server, client, matchId } = setup();
      for (const deviceId of [null, undefined, "", "   "]) {
        const response = await claim(client, matchId, deviceId as any, true);
        expect(response.error).toMatchObject({ code: "22023", message: "invalid_device_id" });
      }
      // Checked before the match is looked up, as in the SQL function.
      expect((await claim(client, "20000000-0000-4000-8000-0000000000ff", "")).error?.code).toBe("22023");
      expect(server.row("matches", matchId)!.scorer_device_id ?? null).toBeNull();
    });

    it("failNextOn('rpc:<name>') fails only that RPC", async () => {
      const { server, client, matchId } = setup();
      server.failNextOn("rpc:claim_match_scorer", "network");
      expect((await client.rpc("get_match_scorer", { p_match_id: matchId })).error).toBeNull();
      expect((await claim(client, matchId, "device-a")).error).not.toBeNull();
      expect((await claim(client, matchId, "device-a")).data.claimed).toBe(true);
    });

    it("answers P0002 for a match that doesn't exist", async () => {
      const { client } = setup();
      expect((await claim(client, "20000000-0000-4000-8000-0000000000ff", "device-a")).error?.code).toBe("P0002");
    });
  });

  describe("the scorer rule on matches", () => {
    it("refuses an edit of the match from a device that is not the scorer", async () => {
      const { server, client, matchId } = setup();
      server.setScorer(matchId, { deviceId: "device-b" });
      const response = await client.from("matches").update({ home_score: 1 }).eq("id", matchId).setHeader("x-device-id", "device-a");
      expect(response.error).toMatchObject({ code: "P0001", message: "scorer_mismatch" });
      expect(server.row("matches", matchId)!.home_score).toBe(0);
    });

    it("accepts an edit from the scorer", async () => {
      const { server, client, matchId } = setup();
      server.setScorer(matchId, { deviceId: "device-a" });
      const response = await client.from("matches").update({ home_score: 1 }).eq("id", matchId).setHeader("x-device-id", "device-a");
      expect(response.error).toBeNull();
      expect(server.row("matches", matchId)!.home_score).toBe(1);
    });

    it("exempts a write that changes the scorer (a claim)", async () => {
      const { server, client, matchId } = setup();
      server.setScorer(matchId, { deviceId: "device-b" });
      const response = await client
        .from("matches")
        .update({ scorer_device_id: "device-a" })
        .eq("id", matchId)
        .setHeader("x-device-id", "device-a");
      expect(response.error).toBeNull();
      expect(server.row("matches", matchId)!.scorer_device_id).toBe("device-a");
    });

    it("lets any device edit a match nobody scores, and requests without x-device-id", async () => {
      const { server, client, matchId } = setup();
      expect((await client.from("matches").update({ home_score: 1 }).eq("id", matchId).setHeader("x-device-id", "device-a")).error).toBeNull();
      server.setScorer(matchId, { deviceId: "device-b" });
      expect((await client.from("matches").update({ home_score: 2 }).eq("id", matchId)).error).toBeNull();
    });
  });

  it("denyWrites refuses inserts and updates with 42501 until allowed again", async () => {
    const { server, client, matchId } = setup();
    const set = server.seed("sets", aSet(matchId));
    server.denyWrites("sets", () => true);
    const insert = await client.from("sets").insert(aSet(matchId, { set_number: 2 }));
    expect(insert).toMatchObject({ status: 403, error: { code: "42501" } });
    const update = await client.from("sets").update({ home_score: 1 }).eq("id", set.id);
    expect(update.error?.code).toBe("42501");
    server.allowWrites("sets");
    expect((await client.from("sets").insert(aSet(matchId, { set_number: 2 }))).error).toBeNull();
  });

  it("dropColumn makes writes carrying that column fail with PGRST204", async () => {
    const { server, client, matchId } = setup();
    server.dropColumn("sets", "current_lineup");
    const insert = await client.from("sets").insert(aSet(matchId));
    expect(insert.error?.code).toBe("PGRST204");
    expect(insert.error?.message).toContain("'current_lineup'");
    const set = server.seed("sets", aSet(matchId));
    const update = await client.from("sets").update({ current_lineup: {} }).eq("id", set.id);
    expect(update.error?.code).toBe("PGRST204");
    expect(server.rows("sets")).toHaveLength(1);
  });

  it("hang() accepts requests to a table without answering until releaseHung()", async () => {
    const { server, client } = setup();
    server.hang("sets");
    let answered = false;
    const hung = Promise.resolve(client.from("sets").select("*")).then((response: any) => {
      answered = true;
      return response;
    });
    expect((await client.from("matches").select("*")).error).toBeNull(); // other tables answer
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(answered).toBe(false);
    server.releaseHung();
    expect((await hung).error).toBeNull();
    expect((await client.from("sets").select("*")).error).toBeNull();
  });

  it("hang() can be narrowed to some requests of a table", async () => {
    const { server, client } = setup();
    server.hang("sets", (query) => query.ids().length > 0);
    expect((await client.from("sets").select("*")).error).toBeNull(); // not narrowed out
    let answered = false;
    const hung = Promise.resolve(client.from("sets").select("*").in("id", ["20000000-0000-4000-8000-0000000000aa"])).then(() => {
      answered = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(answered).toBe(false);
    server.releaseHung();
    await hung;
  });

  it("latencyMs delays every request", async () => {
    const { server, client } = setup();
    const timeRequests = async () => {
      const started = performance.now();
      for (let n = 0; n < 3; n++) await client.from("sets").select("*");
      return performance.now() - started;
    };
    await timeRequests(); // warm up
    const unlatenced = await timeRequests();
    server.latencyMs = 60;
    const latenced = await timeRequests();
    server.latencyMs = 0;
    // Three requests at 60 ms each: compared with the same requests without latency, not with a wall-clock bound.
    expect(latenced - unlatenced).toBeGreaterThanOrEqual(3 * 55);
  });
});
