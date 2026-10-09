import { expect } from "vitest";
import type { LocalDatabase } from "@/lib/rxdb/collections";
import { docsEqual } from "@/lib/rxdb/sync/conflict-handler";
import { pickSchemaFields } from "@/lib/rxdb/sync/helper";
import { SyncManager } from "@/lib/rxdb/sync/manager";
import type { PendingChanges } from "@/lib/rxdb/sync/pending-changes";
import { MATCH_COLLECTIONS, type SyncUser } from "@/lib/rxdb/sync/types";
import type { FakeSupabaseServer } from "../fakes/fake-supabase";
import { createFakePlatform } from "./fake-platform";
import { aPlayerStat, aScorePoint, aSet, HOME_TEAM_ID, USER_ID } from "./fixtures";
import { createTestDb } from "./test-db";
import { waitFor } from "./wait";

export const testUser = (id = USER_ID): SyncUser => ({ id, teamIds: [HOME_TEAM_ID], clubIds: [] });

/** One device: its own local database, platform and sync manager, talking to the shared fake server. */
export class TestDevice {
  online = true;
  /** Whether the client holds a session; without one its requests carry the anon key. */
  signedIn = true;
  manager: SyncManager;
  readonly platform: ReturnType<typeof createFakePlatform>;

  private constructor(
    readonly server: FakeSupabaseServer,
    readonly db: LocalDatabase,
    readonly pending: PendingChanges,
    readonly deviceId: string,
    private readonly userName: string
  ) {
    this.platform = createFakePlatform(deviceId);
    this.manager = this.createManager();
  }

  static async create(server: FakeSupabaseServer, options: { deviceId?: string; userName?: string } = {}): Promise<TestDevice> {
    const { db, pending } = await createTestDb();
    return new TestDevice(server, db, pending, options.deviceId ?? "device-a", options.userName ?? "Alex");
  }

  private createManager(): SyncManager {
    return new SyncManager({
      db: this.db,
      client: this.server.client({ online: () => this.online, userName: this.userName, signedIn: () => this.signedIn }),
      platform: this.platform.platform,
      pending: this.pending,
      waitForLeadership: false,
      retryTime: 50,
    });
  }

  signIn(user: SyncUser = testUser()): Promise<void> {
    return this.manager.setUser(user);
  }

  /** Closing the app and opening it again: the manager goes away, the local database stays. */
  async restart(): Promise<void> {
    await this.manager.destroy();
    this.manager = this.createManager();
  }

  goOffline(): void {
    this.online = false;
    this.platform.setOnline(false);
  }

  goOnline(): void {
    this.online = true;
    this.platform.setOnline(true);
  }

  openMatch(matchId: string): Promise<boolean> {
    return this.manager.syncMatch(matchId, 5000);
  }

  async startSet(matchId: string, overrides: Record<string, unknown> = {}) {
    const set = aSet(matchId, overrides);
    await this.db.sets.insert(set as any);
    return set;
  }

  /** What PlayerStatCommand + ScorePointCommand write for one point. */
  async recordPoint(matchId: string, setId: string, pointNumber: number) {
    const stat = aPlayerStat(matchId, setId);
    await this.db.player_stats.insert(stat as any);
    const point = aScorePoint(matchId, setId, pointNumber, { player_stat_id: stat.id });
    await this.db.score_points.insert(point as any);
    await this.db.sets.findOne(setId).update({ $set: { home_score: pointNumber } });
    return { stat, point };
  }

  /** Waits until nothing of the match is pending and its replications are in sync. */
  async settle(matchId: string, timeoutMs = 10_000): Promise<void> {
    await waitFor(async () => (await this.pending.count({ matchId, statuses: ["pending"] })) === 0, {
      timeoutMs,
      message: `match ${matchId} uploaded`,
    });
    await Promise.race([
      this.manager.awaitMatchInSync(matchId),
      new Promise((_, reject) => setTimeout(() => reject(new Error("replications not in sync")), timeoutMs)),
    ]);
  }

  async dispose(): Promise<void> {
    await this.manager.destroy();
    await this.db.remove();
  }
}

/** The server's rows of the match equal the device's, field by field (deleted rows excluded). */
export async function expectServerEqualsDevice(device: TestDevice, matchId: string): Promise<void> {
  for (const table of MATCH_COLLECTIONS) {
    const collection = device.db[table] as any;
    const selector = table === "matches" ? { id: matchId } : { match_id: matchId };
    const local = (await collection.find({ selector }).exec()).map((doc: any) => ({ ...doc.toJSON(), _deleted: false }));
    const properties = collection.schema.jsonSchema.properties as Record<string, unknown>;
    const remote = device.server
      .rows(table, (row) => (table === "matches" ? row.id === matchId : row.match_id === matchId) && !row._deleted)
      .map((row) => pickSchemaFields(row, properties));
    expect(remote.map((row) => row.id).sort(), `${table}: same rows`).toEqual(local.map((doc: any) => doc.id).sort());
    for (const doc of local) {
      const row = remote.find((candidate) => candidate.id === doc.id);
      expect(docsEqual(row, doc), `${table} ${doc.id}: same values`).toBe(true);
    }
  }
}
