import { SupabaseClient } from '@supabase/supabase-js';
import { RxReplicationState } from 'rxdb/plugins/replication';
import { DatabaseCollections } from '../database';
import { RxDatabase } from 'rxdb';
import { replicateSupabase } from './index';
import { CollectionName } from '../schema';
import { User } from '@/lib/types';

const LAST_N_MATCHES = 5;
const dynamicCollections: CollectionName[] = ['matches', 'sets', 'score_points', 'player_stats', 'events'];

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
    for (const state of this.replicationStates.values()) {
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

      for (const state of this.replicationStates.values()) {
        if (!state.isPaused()) return;
        // state.reSync(); // Trigger resync when coming back online
        promises.push(state.start());
      }
    } else {
      // When going offline, we might want to pause replications to save resources
      for (const state of this.replicationStates.values()) {
        if (state.isPaused()) return;
        promises.push(state.pause());
      }
    }
    await Promise.all(promises);
  }

  async syncMatch(matchId: string) {
    if (this.activeMatchIds.has(matchId)) {
      console.log(`SyncManager: Match ${matchId} is already being synced.`);
      this.reSyncMatch(matchId);
      return;
    }

    this.activeMatchIds.add(matchId);
    console.log(`Force syncing match: ${matchId}`);

    // Restart detailed replications with new filter
    await this.startDynamicSync(matchId);
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
      this.startCollectionSync('club_members', this.getReplicationIdentifier('club_members'), ({ query }) => {
        query.in('club_id', this.user.clubMembers!.map((cm: any) => cm.club_id));
        return query;
      });
    }

    if (this.user.teamMembers && this.user.teamMembers.length > 0) {
      this.startCollectionSync('team_members', this.getReplicationIdentifier('team_members'), ({ query }) => {
        query.in('team_id', this.user.teamMembers!.map((tm: any) => tm.team_id));
        return query;
      });
    }

    // await this.updateLastMatches();
    // this.restartDynamicSync();
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
        .limit(LAST_N_MATCHES);
      if (mError) throw mError;

      if (matches) {
        matches.forEach(m => this.activeMatchIds.add(m.id));
      }
      console.debug(`Added ${matches?.length || 0} 'My Matches' to active sync set.`);

    } catch (e) {
      console.error("Failed to add 'My Matches' to active set:", e);
    }
  }

  private async startDynamicSync(matchId: string) {
    // Chain the execution to prevent race conditions where multiple calls
    // create overlapping replication states, leading to memory leaks.
    this.dynamicSyncPromise = this.dynamicSyncPromise.then(async () => {
      console.debug(`SyncManager: Starting dynamic sync for match: ${matchId}`);

      const promises: Promise<any>[] = [];


      const identifierSuffix = `_chunk_${matchId}`;

      for (const collectionName of dynamicCollections) {
        const replicationIdentifier = this.getReplicationIdentifier(collectionName, identifierSuffix);

        // Cancel existing
        const existing = this.replicationStates.get(replicationIdentifier);
        if (existing) {
          console.debug(`SyncManager: Cancelling existing sync for collection ${collectionName} and match ${matchId}.`);
          await existing.remove();
          this.replicationStates.delete(replicationIdentifier); // Ensure it's removed from map immediately
        }

        // Start new

        if (collectionName === 'matches') {
          console.debug(`SyncManager: Starting sync for collection ${collectionName} with match filter.`);
          const state = this.startCollectionSync(collectionName, replicationIdentifier, ({ query }) => query.eq('id', matchId), `id=eq.${matchId}`);
          if (state) {
            console.debug(`SyncManager: (To be removed) Awaiting initial replication for collection ${collectionName}.`);
            promises.push(state.awaitInitialReplication());
          }
        } else {
          console.debug(`SyncManager: Starting sync for collection ${collectionName} with match filter.`);
          const state = this.startCollectionSync(collectionName, replicationIdentifier, ({ query }) => query.eq('match_id', matchId), `match_id=eq.${matchId}`);
          if (state) {
            console.debug(`SyncManager: (To be removed) Awaiting initial replication for collection ${collectionName}.`);
            promises.push(state.awaitInitialReplication());
          }
        }

      }

      await Promise.all(promises);
    });

    return this.dynamicSyncPromise;
  }

  private async reSyncMatch(matchId: string) {
    console.debug(`SyncManager: Resync for match: ${matchId}`);
    const identifierSuffix = `_chunk_${matchId}`;
    for (const collectionName of dynamicCollections) {
      const replicationIdentifier = this.getReplicationIdentifier(collectionName, identifierSuffix);

      const existing = this.replicationStates.get(replicationIdentifier);
      if (existing) {
        existing.reSync();
        console.debug(`SyncManager: Resyncing existing sync for collection ${collectionName} and match ${matchId}.`);
      }
    }
  }

  private dynamicSyncPromise: Promise<void> = Promise.resolve();

  private async restartDynamicSync() {
    // Chain the execution to prevent race conditions where multiple calls
    // create overlapping replication states, leading to memory leaks.
    this.dynamicSyncPromise = this.dynamicSyncPromise.then(async () => {
      const matchIds = Array.from(this.activeMatchIds);
      console.debug(`SyncManager: Restarting dynamic sync for matches: ${matchIds.join(', ')}`);

      const promises: Promise<any>[] = [];

      for (const matchId of matchIds) {
        const identifierSuffix = `_chunk_${matchId}`;

        for (const collectionName of dynamicCollections) {
          const replicationIdentifier = this.getReplicationIdentifier(collectionName, identifierSuffix);

          // Cancel existing
          const existing = this.replicationStates.get(replicationIdentifier);
          if (existing) {
            console.debug(`SyncManager: Cancelling existing sync for collection ${collectionName} and match ${matchId}.`);
            await existing.remove();
            this.replicationStates.delete(replicationIdentifier); // Ensure it's removed from map immediately
          }

          // Start new

          if (collectionName === 'matches') {
            console.debug(`SyncManager: Starting sync for collection ${collectionName} with match filter.`);
            const state = this.startCollectionSync(collectionName, replicationIdentifier, ({ query }) => query.eq('id', matchId), `id=eq.${matchId}`);
            if (state) {
              console.debug(`SyncManager: (To be removed) Awaiting initial replication for collection ${collectionName}.`);
              promises.push(state.awaitInitialReplication());
            }
          } else {
            console.debug(`SyncManager: Starting sync for collection ${collectionName} with match filter.`);
            const state = this.startCollectionSync(collectionName, replicationIdentifier, ({ query }) => query.eq('match_id', matchId), `match_id=eq.${matchId}`);
            if (state) {
              console.debug(`SyncManager: (To be removed) Awaiting initial replication for collection ${collectionName}.`);
              promises.push(state.awaitInitialReplication());
            }
          }

        }
      }

      await Promise.all(promises);
    });

    return this.dynamicSyncPromise;
  }

  private startCollectionSync(collectionName: string, replicationIdentifier: string = '', queryBuilder?: (q: any) => any, liveFilter?: string): RxReplicationState<any, any> | undefined {
    const collection = this.db.collections[collectionName as CollectionName] as any;
    if (!collection) return undefined;

    if (!replicationIdentifier) {
      replicationIdentifier = this.getReplicationIdentifier(collectionName);
    }

    const replicationState = replicateSupabase({
      replicationIdentifier,
      collection: collection,
      client: this.client,
      tableName: collectionName,
      pull: {
        queryBuilder: queryBuilder,
        liveFilter: liveFilter
      },
      push: {}, // Default push
      live: true,
      autoStart: true,
      modifiedField: "updated_at",
      deletedField: "_deleted",
    });

    this.replicationStates.set(replicationIdentifier, replicationState);

    replicationState.error$.subscribe(err => {
      console.error(`Sync error for ${collectionName} (${replicationIdentifier}):`, err);
    });

    return replicationState;
  }

  private getReplicationIdentifier(collectionName: string, identifierSuffix: string = ''): string {
    return `sync_${collectionName}${identifierSuffix}`;
  }
}
