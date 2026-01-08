import { SupabaseClient } from '@supabase/supabase-js';
import { RxReplicationState } from 'rxdb/plugins/replication';
import { DatabaseCollections } from '../database';
import { RxDatabase } from 'rxdb';
import { replicateSupabase } from './index';
import { CollectionName } from '../schema';
import { User } from '@/lib/types';

const LAST_N_MATCHES = 10;

export class SyncManager {
  private db: RxDatabase<DatabaseCollections>;
  private client: SupabaseClient;
  private replicationStates: Map<string, RxReplicationState<any, any>> = new Map();
  private activeMatchIds: Set<string> = new Set();
  private userId: string | null = null;

  private user: any | null = null; // Using any to avoid circular dependency or strict type issues for now, but ideally User type

  constructor(db: RxDatabase<DatabaseCollections>, client: SupabaseClient) {
    this.db = db;
    this.client = client;
  }

  async initialize() {
    //Nothing to do for now
  }

  public cleanup() {
    this.stopSync();
    //TODO Verify if we need to do anything else here
  }

  public async setUser(user: User | null) {
    this.user = user;
    this.userId = user?.id || null;
    // Cancel existing
    await this.stopSync();
    if (user) {
      await this.startSync();
    }
  }

  private async stopSync() {
    console.debug('SyncManager: Stopping sync...');
    const promises: Promise<any>[] = [];
    for(const state of this.replicationStates.values()) {
      promises.push(state.cancel());
    }
    await Promise.all(promises);
    this.replicationStates.clear();
  }

  public async setOnlineStatus(isOnline: boolean) {
    console.log(`SyncManager: Network status changed to ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
    const promises: Promise<any>[] = [];
    if (isOnline) {
      // When coming back online, we should try to refresh our active match list
      // because initialization might have failed to fetch "Last N" from server or "My Matches".
      // console.log('SyncManager: Refreshing active matches and restarting sync...');
      // await this.updateLastMatches();
      // await this.restartDynamicSync();

      for(const state of this.replicationStates.values()) {
        if(!state.isPaused()) return;
        // state.reSync(); // Trigger resync when coming back online
        promises.push(state.start());
      }
    } else {
      // When going offline, we might want to pause replications to save resources
      for(const state of this.replicationStates.values()) {
        if(state.isPaused()) return;
        promises.push(state.pause());
      }
    }
    await Promise.all(promises);
  }

  async syncMatch(matchId: string) {
    // if (this.activeMatchIds.has(matchId)) return;

    this.activeMatchIds.add(matchId);
    console.log(`Force syncing match: ${matchId}`);

    // Restart detailed replications with new filter
    await this.restartDynamicSync();
    console.log(`SyncManager: Sync for match ${matchId} finished.`);
  }

  private async startSync() {
    console.debug('SyncManager: Starting sync...');
    // 1. Static/User-Scoped Collections
    this.startCollectionSync('championships');
    this.startCollectionSync('seasons');
    this.startCollectionSync('match_formats');
    this.startCollectionSync('clubs');
    this.startCollectionSync('teams');

    // Restart user-scoped collections with new user
    if (this.user.clubMembers && this.user.clubMembers.length > 0) {
      this.startCollectionSync('club_members', ({ query }) => {
        query.in('club_id', this.user.clubMembers!.map((cm: any) => cm.club_id));
        return query;
      });
    }

    if (this.user.teamMembers && this.user.teamMembers.length > 0) {
      this.startCollectionSync('team_members', ({ query }) => {
        query.in('team_id', this.user.teamMembers!.map((tm: any) => tm.team_id));
        return query;
      });
    }

    await this.updateLastMatches();
    this.startCollectionSync('matches', ({ query }) => {
      query.in('id', this.activeMatchIds);
      return query;
    });
  }

  private async updateLastMatches() {
    if (!this.user || !this.user.teamMembers) return;

    try {
      // 1. Get User's Teams from User Object
      const teamIds = this.user.teamMembers.map((tm: any) => tm.team_id) || [];

      if (teamIds.length === 0) return;

      // 2. Fetch Matches for these teams
      // We want matches where either home_team or away_team is in the user's teams.
      // Supabase (PostgREST) supports `or` filter.
      const { data: matches, error: mError } = await this.client
        .from('matches')
        .select('id')
        .or(`home_team_id.in.(${teamIds.join(',')}),away_team_id.in.(${teamIds.join(',')})`)
        .in('status', ['completed', 'live'])
        .order('date', { ascending: false })
        .limit(5); // Limit to avoid fetching too many if user has many matches
      if (mError) throw mError;

      if (matches) {
        matches.forEach(m => this.activeMatchIds.add(m.id));
      }
      console.debug(`Added ${matches?.length || 0} 'My Matches' to active sync set.`);

    } catch (e) {
      console.error("Failed to add 'My Matches' to active set:", e);
    }
  }

  private dynamicSyncPromise: Promise<void> = Promise.resolve();

  private async restartDynamicSync() {
    // Chain the execution to prevent race conditions where multiple calls
    // create overlapping replication states, leading to memory leaks.
    this.dynamicSyncPromise = this.dynamicSyncPromise.then(async () => {

      const dynamicCollections: CollectionName[] = ['matches', 'sets', 'score_points', 'player_stats', 'events'];
      const matchIds = Array.from(this.activeMatchIds);
      console.debug(`SyncManager: Restarting dynamic sync for matches: ${matchIds.join(', ')}`);


      // Create a hash of the match IDs to ensure we reset the checkpoint when the filter changes.
      const filterHash = matchIds.sort().join('|');
      let hash = 0;
      for (let i = 0; i < filterHash.length; i++) {
        const char = filterHash.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      const identifierSuffix = `_${hash}`;

      const promises: Promise<any>[] = [];

      for (const name of dynamicCollections) {
        // Cancel existing
        const existing = this.replicationStates.get(name);
        if (existing) {
          console.debug(`SyncManager: Cancelling existing sync for collection ${name}`);
          await existing.remove();
          this.replicationStates.delete(name); // Ensure it's removed from map immediately
        }

        // Start new
        if (matchIds.length > 0) {
          if (name === 'matches') {
            console.debug(`SyncManager: Starting sync for collection ${name} with match filter.`);
            const state = this.startCollectionSync(name, ({ query }) => query.in('id', matchIds), identifierSuffix);
            if (state) {
              console.debug(`SyncManager: (To be removed) Awaiting initial replication for collection ${name}.`);
              promises.push(state.awaitInitialReplication());
            }
          } else {
            console.debug(`SyncManager: Starting sync for collection ${name} with match filter.`);
            const state = this.startCollectionSync(name, ({ query }) => query.in('match_id', matchIds), identifierSuffix);
            if (state) {
              console.debug(`SyncManager: (To be removed) Awaiting initial replication for collection ${name}.`);
              promises.push(state.awaitInitialReplication());
            }
          }
        }
      }

      await Promise.all(promises);
    });

    return this.dynamicSyncPromise;
  }

  private startCollectionSync(name: string, queryBuilder?: (q: any) => any, identifierSuffix: string = ''): RxReplicationState<any, any> | undefined {
    const collection = this.db.collections[name as CollectionName] as any;
    if (!collection) return undefined;

    const replicationState = replicateSupabase({
      replicationIdentifier: `sync_${name}${identifierSuffix}`,
      collection: collection,
      client: this.client,
      tableName: name,
      pull: {
        queryBuilder: queryBuilder
      },
      push: {}, // Default push
      live: true,
      autoStart: true,
      modifiedField: "updated_at",
      deletedField: "_deleted",
    });

    this.replicationStates.set(name, replicationState);

    replicationState.error$.subscribe(err => {
      console.error(`Sync error for ${name}:`, err);
    });

    return replicationState;
  }
}
