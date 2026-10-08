import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { filter, firstValueFrom } from "rxjs";
import type { LocalDatabase } from "@/lib/rxdb/collections";
import { TrackedMatches } from "@/lib/rxdb/sync/tracked-matches";
import { createTestDb } from "../helpers/test-db";

describe("tracked matches", () => {
  let db: LocalDatabase;
  let tracked: TrackedMatches;

  beforeEach(async () => {
    ({ db } = await createTestDb());
    tracked = new TrackedMatches(db);
  });
  afterEach(async () => {
    await db.remove();
  });

  it("tracks a match for a user", async () => {
    await tracked.track("m1", "user-1", "2026-10-07T10:00:00.000Z");
    expect(await tracked.entry("m1")).toEqual({ userId: "user-1", claim: null, lastOpenedAt: "2026-10-07T10:00:00.000Z", lostTo: null });
  });

  it("keeps the claim when the same user opens the match again", async () => {
    await tracked.track("m1", "user-1");
    await tracked.setClaim("m1", "held");
    await tracked.track("m1", "user-1", "2026-10-08T10:00:00.000Z");
    expect(await tracked.entry("m1")).toMatchObject({ claim: "held", lastOpenedAt: "2026-10-08T10:00:00.000Z" });
  });

  it("resets the claim when another user opens the match", async () => {
    await tracked.track("m1", "user-1");
    await tracked.setClaim("m1", "held");
    await tracked.track("m1", "user-2");
    expect(await tracked.entry("m1")).toMatchObject({ userId: "user-2", claim: null });
  });

  it("removes a match", async () => {
    await tracked.track("m1", "user-1");
    await tracked.remove("m1");
    expect(await tracked.entry("m1")).toBeNull();
  });

  it("emits changes", async () => {
    const next = firstValueFrom(tracked.get$().pipe(filter((map) => !!map.m2)));
    await tracked.track("m2", "user-1");
    expect((await next).m2.userId).toBe("user-1");
  });

  it("serializes concurrent changes", async () => {
    await Promise.all(["a", "b", "c", "d", "e"].map((id) => tracked.track(id, "user-1")));
    expect(Object.keys(await tracked.get()).sort()).toEqual(["a", "b", "c", "d", "e"]);
  });
});
