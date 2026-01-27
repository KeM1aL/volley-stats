import { SupabaseClient } from '@supabase/supabase-js';
import { RxReplicationState } from 'rxdb/plugins/replication';
import { DatabaseCollections } from '../database';
import { RxDatabase } from 'rxdb';
import { replicateSupabase } from './index';
import { CollectionName } from '../schema';
import { User } from '@/lib/types';
import { mergeMap, map } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { SyncStateDocument, DynamicCollectionName } from './types';

const LAST_N_MATCHES = 5;
const dynamicCollections: CollectionName[] = ['matches', 'sets', 'score_points', 'player_stats', 'events'];
const SYNC_TIMEOUT_MS = 30 * 1000; // 30 seconds
const MAX_SYNC_RETRIES = 3;

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

  async syncMatch(matchId: string): Promise<boolean> {
    if (this.activeMatchIds.has(matchId)) {
      console.log(`SyncManager: Match ${matchId} is already being synced.`);

      // Check if we need to resync (never synced or error state only)
      const syncState = await this.getMatchSyncState(matchId);
      if (this.isSyncStateStale(syncState)) {
        console.debug(`SyncManager: Match ${matchId} needs sync (status: ${syncState?.status || 'none'}), resyncing`);
        this.reSyncMatch(matchId);
      }

      // Wait for sync completion (with timeout)
      return this.waitForMatchSync(matchId);
    }

    this.activeMatchIds.add(matchId);
    console.log(`Force syncing match: ${matchId}`);

    // Start dynamic sync (non-blocking, uses observers)
    await this.startDynamicSync(matchId);

    // Wait for sync completion (with timeout)
    const synced = await this.waitForMatchSync(matchId);

    console.log(`SyncManager: Sync for match ${matchId} ${synced ? 'completed' : 'timed out or failed'}.`);
    return synced;
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

      // Initialize or retrieve sync state
      let syncState = await this.getMatchSyncState(matchId);
      if (!syncState) {
        syncState = await this.initMatchSyncState(matchId);
        if (!syncState) {
          // Failed to initialize sync state
          syncState = await this.getMatchSyncState(matchId);
        }
      }

      // Mark as syncing
      await this.updateMatchSyncState(matchId, { status: 'syncing' });

      const identifierSuffix = `_chunk_${matchId}`;

      for (const collectionName of dynamicCollections) {
        const replicationIdentifier = this.getReplicationIdentifier(collectionName, identifierSuffix);

        // Cancel existing
        const existing = this.replicationStates.get(replicationIdentifier);
        if (existing) {
          console.debug(`SyncManager: Cancelling existing sync for ${collectionName} and match ${matchId}.`);
          await existing.remove();
          this.replicationStates.delete(replicationIdentifier);
        }

        // Start new replication
        let state: RxReplicationState<any, any> | undefined;

        if (collectionName === 'matches') {
          state = this.startCollectionSync(
            collectionName,
            replicationIdentifier,
            ({ query }) => query.eq('id', matchId),
            `id=eq.${matchId}`
          );
        } else {
          state = this.startCollectionSync(
            collectionName,
            replicationIdentifier,
            ({ query }) => query.eq('match_id', matchId),
            `match_id=eq.${matchId}`
          );
        }

        // Setup observer instead of awaiting (NON-BLOCKING!)
        if (state) {
          this.setupSyncStateObserver(matchId, collectionName as DynamicCollectionName, state);
        }
      }

      console.debug(`SyncManager: Dynamic sync initiated for match: ${matchId}`);
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

      for (const matchId of matchIds) {
        // Initialize sync state if needed
        let syncState = await this.getMatchSyncState(matchId);
        if (!syncState) {
          await this.initMatchSyncState(matchId);
        }

        await this.updateMatchSyncState(matchId, { status: 'syncing' });

        const identifierSuffix = `_chunk_${matchId}`;

        for (const collectionName of dynamicCollections) {
          const replicationIdentifier = this.getReplicationIdentifier(collectionName, identifierSuffix);

          const existing = this.replicationStates.get(replicationIdentifier);
          if (existing) {
            await existing.remove();
            this.replicationStates.delete(replicationIdentifier);
          }

          let state: RxReplicationState<any, any> | undefined;

          if (collectionName === 'matches') {
            state = this.startCollectionSync(
              collectionName,
              replicationIdentifier,
              ({ query }) => query.eq('id', matchId),
              `id=eq.${matchId}`
            );
          } else {
            state = this.startCollectionSync(
              collectionName,
              replicationIdentifier,
              ({ query }) => query.eq('match_id', matchId),
              `match_id=eq.${matchId}`
            );
          }

          if (state) {
            this.setupSyncStateObserver(matchId, collectionName as DynamicCollectionName, state);
          }
        }
      }

      console.debug(`SyncManager: Restart initiated for all active matches`);
    });

    return this.dynamicSyncPromise;
  }

  private startCollectionSync(collectionName: string, replicationIdentifier: string = '', queryBuilder?: (q: any) => any, liveFilter?: string): RxReplicationState<any, any> | undefined {
    const collection = this.db.collections[collectionName as CollectionName] as any;
    if (!collection) return undefined;

    if (!replicationIdentifier) {
      replicationIdentifier = this.getReplicationIdentifier(collectionName);
    }

    // Extract matchId from replicationIdentifier if it's a chunked sync
    const matchIdMatch = replicationIdentifier.match(/_chunk_(.+)$/);
    const matchId = matchIdMatch ? matchIdMatch[1] : null;

    // Enhanced query builder that respects last sync time
    const enhancedQueryBuilder = matchId
      ? async (params: any) => {
          let query = params.query;

          // Apply custom filter first
          if (queryBuilder) {
            const maybeNewQuery = queryBuilder({ query: params.query });
            if (maybeNewQuery) {
              query = maybeNewQuery;
            }
          }

          // Optimize: only pull data updated since last sync (using server timestamp)
          const syncState = await this.getMatchSyncState(matchId);
          const lastUpdatedAt = syncState?.collections[collectionName as DynamicCollectionName]?.lastUpdatedAt;
          if (lastUpdatedAt && lastUpdatedAt !== '') {
            console.debug(`SyncManager: Optimizing pull for ${collectionName} - only fetching data newer than ${lastUpdatedAt}`);
            query = query.gt('updated_at', lastUpdatedAt);
          }

          return query;
        }
      : queryBuilder;

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

  private async getMatchSyncState(matchId: string): Promise<SyncStateDocument | null> {
    const localDoc = await this.db.getLocal(`sync-state-${matchId}`);
    return localDoc ? (localDoc.toMutableJSON().data as unknown as SyncStateDocument) : null;
  }

  private async initMatchSyncState(matchId: string): Promise<SyncStateDocument | null> {
    const initialState: SyncStateDocument = {
      matchId,
      lastSyncTime: 0,
      collections: {
        matches: { lastUpdatedAt: '', hasSynced: false },
        sets: { lastUpdatedAt: '', hasSynced: false },
        score_points: { lastUpdatedAt: '', hasSynced: false },
        player_stats: { lastUpdatedAt: '', hasSynced: false },
        events: { lastUpdatedAt: '', hasSynced: false },
      },
      status: 'never-synced'
    }
    await this.db.insertLocal(`sync-state-${matchId}`, initialState).catch(() => {
      // Already exists, ignore error
      return null;
    });
    return initialState;
  }

  private async updateMatchSyncState(
    matchId: string,
    updates: Partial<SyncStateDocument>
  ): Promise<void> {
    let current = await this.getMatchSyncState(matchId);
    if (!current) {
      current = await this.initMatchSyncState(matchId);
    }
    await this.db.upsertLocal(`sync-state-${matchId}`, {
      ...current,
      ...updates,
      lastSyncTime: Date.now()
    });
  }

  private async updateCollectionSyncTime(
    matchId: string,
    collectionName: DynamicCollectionName
  ): Promise<void> {
    const state = await this.getMatchSyncState(matchId);
    if (!state) return;

    // Get the max updated_at timestamp from the synced data (server-side timestamp)
    const collection = this.db.collections[collectionName];
    if (!collection) return;

    let maxUpdatedAt = '';

    try {
      // Query for documents matching this match
      const selector = collectionName === 'matches'
        ? { id: matchId }
        : { match_id: matchId };

      const docs = await collection.find({ selector }).exec();

      // Find the maximum updated_at timestamp (empty if no docs, which is fine!)
      if (docs.length > 0) {
        maxUpdatedAt = docs.reduce((max: string, doc: any) => {
          const docUpdatedAt = doc.get('updated_at') || '';
          return docUpdatedAt > max ? docUpdatedAt : max;
        }, '');
      }
    } catch (error) {
      console.error(`Error getting max updated_at for ${collectionName}:`, error);
    }

    // Mark as synced regardless of data presence - replication completed!
    state.collections[collectionName] = { lastUpdatedAt: maxUpdatedAt, hasSynced: true };
    await this.db.upsertLocal(`sync-state-${matchId}`, state);

    // Check if all collections are synced
    await this.checkAndUpdateMatchSyncStatus(matchId);
  }

  private async checkAndUpdateMatchSyncStatus(matchId: string): Promise<void> {
    const state = await this.getMatchSyncState(matchId);
    if (!state) return;

    // Check if all collections have completed their initial replication
    const allSynced = dynamicCollections.every(
      col => state.collections[col as DynamicCollectionName].hasSynced
    );

    if (allSynced && state.status !== 'synced') {
      await this.updateMatchSyncState(matchId, { status: 'synced' });
      console.debug(`SyncManager: All collections synced for match ${matchId}`);
    }
  }

  private isSyncStateStale(syncState: SyncStateDocument | null): boolean {
    // For local-first: only re-sync if never synced or in error state
    // Once synced, live replication keeps us updated automatically
    if (!syncState) return true;
    return syncState.status === 'never-synced' || syncState.status === 'error';
  }

  private setupSyncStateObserver(
    matchId: string,
    collectionName: DynamicCollectionName,
    replicationState: RxReplicationState<any, any>
  ): void {
    replicationState.active$
      .pipe(
        mergeMap(async (isActive) => {
          if (isActive) {
            await replicationState.awaitInSync();
            await this.updateCollectionSyncTime(matchId, collectionName);
            console.debug(`SyncManager: Collection ${collectionName} synced for match ${matchId}`);
          }
        })
      )
      .subscribe({
        error: (err) => {
          console.error(`Sync state observer error for ${collectionName}:`, err);
          this.updateMatchSyncState(matchId, {
            status: 'error',
            lastError: err.message,
            lastErrorTime: Date.now()
          });
        }
      });
  }

  public observeMatchSyncState$(matchId: string): Observable<SyncStateDocument | null> {
    return this.db.getLocal$(`sync-state-${matchId}`)
      .pipe(
        map(localDoc => localDoc ? (localDoc.toMutableJSON().data as unknown as SyncStateDocument) : null)
      );
  }

  public async waitForMatchSync(
    matchId: string,
    timeoutMs: number = SYNC_TIMEOUT_MS
  ): Promise<boolean> {
    const syncState = await this.getMatchSyncState(matchId);

    // If already synced, return immediately (live replication keeps it updated)
    if (syncState && syncState.status === 'synced') {
      console.debug(`SyncManager: Match ${matchId} already synced, using local data`);
      return true;
    }

    // Wait for sync to complete with timeout
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.warn(`SyncManager: Sync timeout for match ${matchId}, proceeding anyway`);
        resolve(false);
      }, timeoutMs);

      const subscription = this.observeMatchSyncState$(matchId).subscribe(state => {
        console.debug(`SyncManager: Observing sync state for match ${matchId}:`, state);
        if (state && state.status === 'synced') {
          clearTimeout(timeout);
          subscription.unsubscribe();
          resolve(true);
        } else if (state && state.status === 'error') {
          clearTimeout(timeout);
          subscription.unsubscribe();
          console.error(`Sync error for match ${matchId}:`, state.lastError);
          resolve(false);
        }
      });
    });
  }
}
