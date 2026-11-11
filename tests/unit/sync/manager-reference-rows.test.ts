import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { AWAY_TEAM_ID, FORMAT_ID, HOME_TEAM_ID } from "../helpers/fixtures";
import { waitFor } from "../helpers/wait";
import { setupManagerSuite } from "./manager-helpers";

/** What the live page needs before it can show a match: its format and both teams. */
const MATCH_ROWS = { match_formats: [FORMAT_ID], teams: [HOME_TEAM_ID, AWAY_TEAM_ID] };

const aFormat = (id = FORMAT_ID) => ({
  id,
  description: "Test",
  format: "6x6",
  sets_to_win: 3,
  rotation: true,
  point_by_set: 25,
  point_final_set: 15,
  decisive_point: false,
});

async function timed<T>(work: Promise<T>): Promise<{ value: T; elapsedMs: number }> {
  const start = Date.now();
  const value = await work;
  return { value, elapsedMs: Date.now() - start };
}

describe("SyncManager.awaitReferenceRows", () => {
  const suite = setupManagerSuite();

  it("waits for a match format and teams still being downloaded after sign-in", async () => {
    suite.server().seed("match_formats", aFormat());
    suite.server().hang("match_formats");
    suite.server().hang("teams");
    const d = await suite.device();
    await d.signIn();

    const waiting = d.manager.awaitReferenceRows(MATCH_ROWS, 5_000);
    await waitFor(() => suite.server().hungCount >= 2, { message: "the first format and team pulls" });
    expect(await d.db.match_formats.findOne(FORMAT_ID).exec()).toBeNull();
    suite.server().releaseHung();

    expect(await waiting).toBe(true);
    expect(await d.db.match_formats.findOne(FORMAT_ID).exec()).not.toBeNull();
    expect((await d.db.teams.findByIds([HOME_TEAM_ID, AWAY_TEAM_ID]).exec()).size).toBe(2);
  });

  it("pulls the reference tables again for a team created on the server after the last download", async () => {
    suite.server().seed("match_formats", aFormat());
    const d = await suite.device();
    await d.signIn();
    await waitFor(async () => (await d.db.teams.findByIds([HOME_TEAM_ID, AWAY_TEAM_ID]).exec()).size === 2, {
      message: "the teams downloaded at sign-in",
    });
    const opponentId = randomUUID();
    suite.server().seed("teams", { id: opponentId, name: "New opponent", status: "active", user_id: null });

    expect(await d.manager.awaitReferenceRows({ match_formats: [FORMAT_ID], teams: [HOME_TEAM_ID, opponentId] }, 5_000)).toBe(true);
    expect(await d.db.teams.findOne(opponentId).exec()).not.toBeNull();
  });

  it("resolves at once when the rows are already on the device", async () => {
    suite.server().seed("match_formats", aFormat());
    const d = await suite.device();
    await d.signIn();
    await waitFor(
      async () =>
        !!(await d.db.match_formats.findOne(FORMAT_ID).exec()) &&
        (await d.db.teams.findByIds([HOME_TEAM_ID, AWAY_TEAM_ID]).exec()).size === 2,
      { message: "the format and teams downloaded at sign-in" }
    );

    const { value, elapsedMs } = await timed(d.manager.awaitReferenceRows(MATCH_ROWS, 5_000));
    expect(value).toBe(true);
    expect(elapsedMs).toBeLessThan(200);
  });

  it("resolves false once the time limit is over when a row does not exist on the server", async () => {
    const d = await suite.device();
    await d.signIn();

    const { value, elapsedMs } = await timed(
      d.manager.awaitReferenceRows({ match_formats: [randomUUID()], teams: [HOME_TEAM_ID, AWAY_TEAM_ID] }, 400)
    );
    expect(value).toBe(false);
    expect(elapsedMs).toBeGreaterThanOrEqual(380);
    expect(elapsedMs).toBeLessThan(3_000);
  });

  it("resolves false once the time limit is over when the server cannot be reached", async () => {
    suite.server().seed("match_formats", aFormat());
    const d = await suite.device();
    d.online = false; // the device believes it is online, but its requests fail
    await d.signIn();

    const { value, elapsedMs } = await timed(d.manager.awaitReferenceRows(MATCH_ROWS, 400));
    expect(value).toBe(false);
    expect(elapsedMs).toBeGreaterThanOrEqual(380);
    expect(elapsedMs).toBeLessThan(3_000);
  });
});
