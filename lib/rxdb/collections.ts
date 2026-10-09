import { addRxPlugin, type RxCollection, type RxDatabase } from "rxdb";
import { RxDBLocalDocumentsPlugin } from "rxdb/plugins/local-documents";
import { RxDBQueryBuilderPlugin } from "rxdb/plugins/query-builder";
import { RxDBUpdatePlugin } from "rxdb/plugins/update";
import type {
  Championship,
  Club,
  ClubMember,
  Event,
  Match,
  MatchFormat,
  PlayerStat,
  ScorePoint,
  Season,
  Set,
  Team,
  TeamMember,
} from "@/lib/types";
import {
  championshipSchema,
  clubMemberSchema,
  clubSchema,
  eventSchema,
  matchFormatSchema,
  matchSchema,
  playerSchema,
  playerStatSchema,
  scorePointSchema,
  seasonSchema,
  setSchema,
  teamSchema,
} from "./schema";
import { matchConflictHandler } from "./sync/conflict-handler";
import { installPendingHooks, pendingChangeSchema, PendingChanges, type PendingChange } from "./sync/pending-changes";
import { MATCH_COLLECTIONS } from "./sync/types";

addRxPlugin(RxDBQueryBuilderPlugin);
addRxPlugin(RxDBUpdatePlugin);
addRxPlugin(RxDBLocalDocumentsPlugin);

export type DatabaseCollections = {
  championships: RxCollection<Championship>;
  match_formats: RxCollection<MatchFormat>;
  clubs: RxCollection<Club>;
  club_members: RxCollection<ClubMember>;
  seasons: RxCollection<Season>;
  events: RxCollection<Event>;
  teams: RxCollection<Team>;
  team_members: RxCollection<TeamMember>;
  matches: RxCollection<Match>;
  sets: RxCollection<Set>;
  score_points: RxCollection<ScorePoint>;
  player_stats: RxCollection<PlayerStat>;
  pending_changes: RxCollection<PendingChange>;
};

export type LocalDatabase = RxDatabase<DatabaseCollections>;

const MATCH_TABLES = new Set<string>(MATCH_COLLECTIONS);

/**
 * created_at/updated_at for local writes. Match data gets a fresh updated_at
 * on every edit, which is the edit time the server keeps (spec section 3).
 */
function installTimestampHooks(db: LocalDatabase): void {
  for (const [name, collection] of Object.entries(db.collections)) {
    if (name === "pending_changes") continue;
    const isMatchData = MATCH_TABLES.has(name);
    collection.preInsert((data: any) => {
      const now = new Date().toISOString();
      if (!data.created_at) data.created_at = now;
      if (!data.updated_at) data.updated_at = now;
    }, false);
    collection.preSave((data: any) => {
      if (isMatchData || !data.updated_at) data.updated_at = new Date().toISOString();
    }, false);
    if (isMatchData) {
      collection.preRemove((data: any) => {
        data.updated_at = new Date().toISOString();
      }, false);
    }
  }
}

/** Adds the app's collections to `db`, with conflict handlers and hooks. */
export async function setupCollections(db: LocalDatabase): Promise<PendingChanges> {
  await db.addCollections({
    championships: { schema: championshipSchema },
    match_formats: { schema: matchFormatSchema },
    clubs: { schema: clubSchema },
    club_members: { schema: clubMemberSchema },
    seasons: { schema: seasonSchema },
    teams: { schema: teamSchema },
    team_members: { schema: playerSchema },
    matches: { schema: matchSchema, conflictHandler: matchConflictHandler },
    sets: { schema: setSchema, conflictHandler: matchConflictHandler },
    events: { schema: eventSchema, conflictHandler: matchConflictHandler },
    score_points: { schema: scorePointSchema, conflictHandler: matchConflictHandler },
    player_stats: { schema: playerStatSchema, conflictHandler: matchConflictHandler },
    pending_changes: { schema: pendingChangeSchema },
  });
  const pending = new PendingChanges(db.pending_changes);
  installTimestampHooks(db);
  installPendingHooks(db, pending);
  return pending;
}
