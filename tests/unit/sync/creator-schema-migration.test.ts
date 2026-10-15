import { randomUUID } from "node:crypto";
import { createRxDatabase } from "rxdb";
import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { wrappedValidateAjvStorage } from "rxdb/plugins/validate-ajv";
import { describe, expect, it } from "vitest";
import { setupCollections, type DatabaseCollections } from "@/lib/rxdb/collections";
import { championshipSchema, clubSchema } from "@/lib/rxdb/schema";
import { replicateSupabase } from "@/lib/rxdb/sync/replication";
import { referenceReplicationIdentifier } from "@/lib/rxdb/sync/reference-sync";
import { createFakeServer } from "../helpers/server";
import { createTestDb } from "../helpers/test-db";
import { waitFor } from "../helpers/wait";

// One storage object for both opens: memory storage keeps a database's data per storage object.
const storage = getRxStorageMemory();
const open = (name: string) =>
  createRxDatabase<DatabaseCollections>({
    name,
    storage: wrappedValidateAjvStorage({ storage }),
    multiInstance: false,
    localDocuments: true,
    allowSlowCount: true,
  });

// The schemas as devices have them before account deletion: the creator is always set.
const LEGACY_CLUB_SCHEMA = {
  ...clubSchema,
  version: 0,
  properties: { ...clubSchema.properties, user_id: { type: "string", maxLength: 36 } },
  required: ["id", "name", "user_id", "created_at", "updated_at"],
  indexes: ["user_id", "created_at", "updated_at"],
};
const LEGACY_CHAMPIONSHIP_SCHEMA = {
  ...championshipSchema,
  version: 0,
  properties: { ...championshipSchema.properties, user_id: { type: "string", maxLength: 36 } },
};

const NOW = "2026-10-15T10:00:00.000Z";
const CREATOR = "20000000-0000-4000-8000-000000000001";
const CLUB_ID = "20000000-0000-4000-8000-000000000002";
const CHAMPIONSHIP_ID = "20000000-0000-4000-8000-000000000003";
const FORMAT_ID = "20000000-0000-4000-8000-000000000004";

const club = (overrides: Record<string, unknown> = {}) => ({
  id: CLUB_ID, name: "Club", user_id: CREATOR, website: null, contact_email: null, contact_phone: null,
  created_at: NOW, updated_at: NOW, ...overrides,
});
const championship = (overrides: Record<string, unknown> = {}) => ({
  id: CHAMPIONSHIP_ID, name: "Championship", type: "regional", season_id: null, default_match_format: FORMAT_ID,
  user_id: CREATOR, age_category: "senior", gender: "mixte", ext_code: null, ext_source: null,
  created_at: NOW, updated_at: NOW, ...overrides,
});

describe("clubs and championships accept a null creator (account deletion)", () => {
  it("keeps the clubs and championships of a version-0 database unchanged", async () => {
    const name = `creator_migration_${randomUUID().replace(/-/g, "")}`;
    const before = await open(name);
    await before.addCollections({
      clubs: { schema: LEGACY_CLUB_SCHEMA as any },
      championships: { schema: LEGACY_CHAMPIONSHIP_SCHEMA as any },
    });
    await before.clubs.insert(club() as any);
    await before.championships.insert(championship() as any);
    await before.close();

    const after = await open(name);
    await setupCollections(after);
    expect((await after.clubs.findOne(CLUB_ID).exec())?.toJSON()).toMatchObject({ name: "Club", user_id: CREATOR });
    expect((await after.championships.findOne(CHAMPIONSHIP_ID).exec())?.toJSON()).toMatchObject({
      name: "Championship",
      user_id: CREATOR,
    });
    await after.close();
  });

  it("stores a null user_id on a club and a championship", async () => {
    const { db } = await createTestDb();
    await db.clubs.insert(club({ user_id: null }) as any);
    await db.championships.insert(championship({ user_id: null }) as any);
    expect((await db.clubs.findOne(CLUB_ID).exec())?.toJSON().user_id).toBeNull();
    expect((await db.championships.findOne(CHAMPIONSHIP_ID).exec())?.toJSON().user_id).toBeNull();
    await db.close();
  });

  it("pulls a club and a championship whose creator was removed", async () => {
    const { db } = await createTestDb();
    const server = createFakeServer();
    server.seed("clubs", club({ user_id: null }));
    server.seed("championships", championship({ user_id: null }));
    const states = (["clubs", "championships"] as const).map((table) =>
      replicateSupabase({
        replicationIdentifier: referenceReplicationIdentifier(table, db[table].schema.version, "user-1", []),
        collection: db[table] as any,
        client: server.client({ signedIn: () => true }),
        tableName: table,
        live: false,
        waitForLeadership: false,
        pull: {},
      })
    );
    await Promise.all(states.map((state) => state.awaitInitialReplication()));
    await waitFor(async () => !!(await db.clubs.findOne(CLUB_ID).exec()), { message: "club pulled" });
    expect((await db.clubs.findOne(CLUB_ID).exec())?.toJSON().user_id).toBeNull();
    expect((await db.championships.findOne(CHAMPIONSHIP_ID).exec())?.toJSON().user_id).toBeNull();
    await Promise.all(states.map((state) => state.cancel()));
    await db.close();
  });

  it("is schema version 1, so the reference tables pull again in full once", async () => {
    const { db } = await createTestDb();
    expect(db.clubs.schema.version).toBe(1);
    expect(db.championships.schema.version).toBe(1);
    await db.close();
  });
});
