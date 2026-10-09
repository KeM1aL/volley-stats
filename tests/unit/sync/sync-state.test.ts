import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { LocalDatabase } from "@/lib/rxdb/collections";
import { SyncStates } from "@/lib/rxdb/sync/sync-state";
import { createTestDb } from "../helpers/test-db";

describe("sync states", () => {
  let db: LocalDatabase;
  let states: SyncStates;

  beforeEach(async () => {
    ({ db } = await createTestDb());
    states = new SyncStates(db);
  });
  afterEach(async () => {
    await db.remove();
  });

  it("stores the status of a match", async () => {
    await states.set("m1", "syncing");
    expect((await states.get("m1"))?.status).toBe("syncing");
  });

  it("resolves true once the match is synced", async () => {
    const waiting = states.waitForSynced("m1", 2000);
    await states.set("m1", "synced");
    expect(await waiting).toBe(true);
  });

  it("resolves false after the timeout", async () => {
    expect(await states.waitForSynced("m1", 50)).toBe(false);
  });
});
