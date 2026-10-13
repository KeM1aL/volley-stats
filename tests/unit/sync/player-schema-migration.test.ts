import { randomUUID } from "node:crypto";
import { createRxDatabase } from "rxdb";
import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { wrappedValidateAjvStorage } from "rxdb/plugins/validate-ajv";
import { describe, expect, it } from "vitest";
import { setupCollections, type DatabaseCollections } from "@/lib/rxdb/collections";
import { playerSchema } from "@/lib/rxdb/schema";

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

// The player schema as devices have it before this change.
const { archived_at: _archived, ...legacyProperties } = playerSchema.properties;
const LEGACY_PLAYER_SCHEMA = { ...playerSchema, version: 0, properties: legacyProperties };

const NOW = "2026-10-13T10:00:00.000Z";
const PLAYER_ID = "10000000-0000-4000-8000-000000000003";
const TEAM_ID = "10000000-0000-4000-8000-000000000001";

describe("player schema migration", () => {
  it("keeps the players of a version-0 database, with archived_at null", async () => {
    const name = `migration_${randomUUID().replace(/-/g, "")}`;
    const before = await open(name);
    await before.addCollections({ team_members: { schema: LEGACY_PLAYER_SCHEMA as any } });
    await before.team_members.insert({
      id: PLAYER_ID,
      team_id: TEAM_ID,
      user_id: null,
      name: "Player 7",
      number: 7,
      role: "player",
      position: null,
      comments: null,
      avatar_url: null,
      voice_aliases: [],
      created_at: NOW,
      updated_at: NOW,
    } as any);
    await before.close();

    const after = await open(name);
    await setupCollections(after);
    const doc = await after.team_members.findOne(PLAYER_ID).exec();
    expect(doc?.toJSON()).toMatchObject({ id: PLAYER_ID, name: "Player 7", number: 7, archived_at: null });
    await after.close();
  });

  it("stores archived_at on new players", async () => {
    const db = await open(`fresh_${randomUUID().replace(/-/g, "")}`);
    await setupCollections(db);
    await db.team_members.insert({
      id: PLAYER_ID, team_id: TEAM_ID, user_id: null, name: "Player 7", number: 7, role: "player",
      position: null, comments: null, avatar_url: null, voice_aliases: [], archived_at: NOW,
      created_at: NOW, updated_at: NOW,
    } as any);
    expect((await db.team_members.findOne(PLAYER_ID).exec())?.toJSON().archived_at).toBe(NOW);
    await db.close();
  });
});
