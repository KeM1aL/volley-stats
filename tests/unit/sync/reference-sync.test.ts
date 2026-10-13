import { describe, expect, it } from "vitest";
import { filterKey, referenceReplicationIdentifier } from "@/lib/rxdb/sync/reference-sync";
import { createTestDb } from "../helpers/test-db";

describe("referenceReplicationIdentifier", () => {
  it("names the table, the schema version, the user and the filter", () => {
    expect(referenceReplicationIdentifier("team_members", 1, "user-1", ["b", "a"])).toBe(
      `sync2_team_members_v1_user-1_${filterKey(["a", "b"])}`
    );
  });

  it("changes when the collection's schema version changes, so the table is pulled again in full", () => {
    const before = referenceReplicationIdentifier("team_members", 0, "user-1", ["team"]);
    const after = referenceReplicationIdentifier("team_members", 1, "user-1", ["team"]);
    expect(after).not.toBe(before);
  });

  it("uses the version of the collection's schema", async () => {
    const { db } = await createTestDb();
    expect(db.team_members.schema.version).toBe(1);
    await db.close();
  });
});
