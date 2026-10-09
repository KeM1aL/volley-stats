import { afterEach, describe, expect, it } from "vitest";
import type { MatchState } from "@/lib/commands/command";
import {
  PlayerStatCommand,
  ScorePointCommand,
  SetSetupCommand,
  SubstitutionCommand,
} from "@/lib/commands/match-commands";
import type { VolleyballDatabase } from "@/lib/rxdb/database";
import type { Match, PlayerStat, ScorePoint, Set } from "@/lib/types";
import { aPlayerStat, aScorePoint, aSet, AWAY_TEAM_ID, HOME_TEAM_ID, PLAYER_ID } from "../helpers/fixtures";
import { createTestDb } from "../helpers/test-db";
import { sleep } from "../helpers/wait";

const MATCH_ID = "20000000-0000-4000-8000-000000000001";

describe("match commands: redo keeps the edit time moving forward", () => {
  const closers: Array<() => Promise<unknown>> = [];
  afterEach(async () => {
    await Promise.all(closers.splice(0).map((close) => close()));
  });

  async function setup() {
    const { db } = await createTestDb();
    closers.push(() => db.remove());
    const set = aSet(MATCH_ID) as unknown as Set;
    await db.sets.insert(set as any);
    const match = {
      id: MATCH_ID,
      home_team_id: HOME_TEAM_ID,
      away_team_id: AWAY_TEAM_ID,
      home_score: 0,
      away_score: 0,
      status: "live",
      match_formats: { format: "6x6", sets_to_win: 3, point_by_set: 25, point_final_set: 15, decisive_point: false, rotation: false },
    } as unknown as Match;
    const state: MatchState = {
      match,
      currentSet: set,
      setPoints: [],
      points: [],
      sets: [set],
      setStats: [],
      stats: [],
      setEvents: [],
      events: [],
      score: { home: 0, away: 0 },
    };
    return { db: db as unknown as VolleyballDatabase, rx: db, state, set };
  }

  /** The row's updated_at after execute, undo, execute: the second execute must be later than the undo. */
  async function expectRedoLater(
    read: () => Promise<string | undefined>,
    command: { execute(): Promise<unknown>; undo(): Promise<unknown> }
  ) {
    await command.execute();
    const first = await read();
    await sleep(5);
    await command.undo();
    expect(await read()).toBeUndefined();
    const afterUndo = Date.now();
    await sleep(5);
    await command.execute();
    const redone = await read();
    expect(redone).toBeDefined();
    expect(Date.parse(redone!)).toBeGreaterThan(afterUndo);
    expect(Date.parse(redone!)).toBeGreaterThan(Date.parse(first!));
  }

  it("a redone point is inserted with a fresh updated_at", async () => {
    const { db, rx, state } = await setup();
    const point = aScorePoint(MATCH_ID, state.currentSet!.id, 1) as unknown as ScorePoint;
    const command = new ScorePointCommand(state, point, true, db);
    await expectRedoLater(async () => (await rx.score_points.findOne(point.id).exec())?.updated_at, command);
  });

  it("a redone set is inserted with a fresh updated_at", async () => {
    const { db, rx, state } = await setup();
    const newSet = aSet(MATCH_ID, { set_number: 2 }) as unknown as Set;
    const command = new SetSetupCommand(state, newSet, db);
    await expectRedoLater(async () => (await rx.sets.findOne(newSet.id).exec())?.updated_at, command);
  });

  it("a redone substitution inserts its event with a fresh updated_at", async () => {
    const { db, rx, state } = await setup();
    const substitution = {
      id: "30000000-0000-4000-8000-000000000001",
      match_id: MATCH_ID,
      team_id: HOME_TEAM_ID,
      set_id: state.currentSet!.id,
      player_out_id: PLAYER_ID,
      player_in_id: PLAYER_ID,
      position: "p1",
      comments: "",
      timestamp: new Date().toISOString(),
    };
    const command = new SubstitutionCommand(state, substitution, db);
    await expectRedoLater(async () => (await rx.events.findOne(substitution.id).exec())?.updated_at, command);
  });

  it("a redone stat and its point are inserted with a fresh updated_at", async () => {
    const { db, rx, state } = await setup();
    const stat = aPlayerStat(MATCH_ID, state.currentSet!.id, { result: "success", stat_type: "spike" }) as unknown as PlayerStat;
    const command = new PlayerStatCommand(state, stat, db);
    await expectRedoLater(async () => (await rx.player_stats.findOne(stat.id).exec())?.updated_at, command);
    const [point] = await rx.score_points.find({ selector: { player_stat_id: stat.id } }).exec();
    expect(Date.parse(point.updated_at!)).toBeGreaterThan(Date.parse(stat.updated_at!));
  });

  it("a first execution keeps the document's own updated_at", async () => {
    const { db, rx, state } = await setup();
    const point = aScorePoint(MATCH_ID, state.currentSet!.id, 1, { updated_at: "2020-01-01T00:00:00.000Z" }) as unknown as ScorePoint;
    await new ScorePointCommand(state, point, true, db).execute();
    expect((await rx.score_points.findOne(point.id).exec())?.updated_at).toBe("2020-01-01T00:00:00.000Z");
  });
});
