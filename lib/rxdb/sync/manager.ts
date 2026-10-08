import type { SupabaseClient } from "@supabase/supabase-js";
import { distinctUntilChanged, filter, type Subscription } from "rxjs";
import type { User } from "@/lib/types";
import type { LocalDatabase } from "../collections";
import type { ClaimCheck } from "./dependencies";
import { MatchSync } from "./match-sync";
import type { PendingChanges } from "./pending-changes";
import type { SyncPlatform } from "./platform/types";
import { ReferenceSync } from "./reference-sync";
import type { ScorerInfo } from "./scorer-claim";
import { SyncStates } from "./sync-state";
import { TRACKED_MATCH_TTL_MS, TrackedMatches, type TrackedMatchMap } from "./tracked-matches";
import type { SyncUser } from "./types";
import { runSyncUpgrade } from "./upgrade";

/** How long the live page waits for a match's first pull. */
export const SYNC_TIMEOUT_MS = 30_000;
const DEFAULT_RETRY_MS = 5_000;

export interface SyncManagerOptions {
  db: LocalDatabase;
  client: SupabaseClient<any>;
  platform: SyncPlatform;
  pending: PendingChanges;
  /** Only the leader tab replicates (default true; tests use false). */
  waitForLeadership?: boolean;
  retryTime?: number;
}

export function toSyncUser(user: User): SyncUser {
  return {
    id: user.id,
    teamIds: (user.teamMembers ?? []).map((member) => member.team_id),
    clubIds: (user.clubMembers ?? []).map((member) => member.club_id),
  };
}

function sameIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sorted = [...b].sort();
  return [...a].sort().every((value, index) => value === sorted[index]);
}

export function sameSyncUser(a: SyncUser | null, b: SyncUser | null): boolean {
  if (!a || !b) return a === b;
  return a.id === b.id && sameIds(a.teamIds, b.teamIds) && sameIds(a.clubIds, b.clubIds);
}

/**
 * Decides what this device replicates (spec section 2): reference tables for
 * the signed-in user, and every tracked match from app start, on any screen.
 */
export class SyncManager {
  readonly tracked: TrackedMatches;
  readonly syncStates: SyncStates;
  readonly pendingChanges: PendingChanges;
  private user: SyncUser | null = null;
  private readonly reference: ReferenceSync;
  private readonly matches = new Map<string, MatchSync>();
  private trackedSubscription: Subscription | null = null;
  private readonly platformSubscriptions: Subscription[];
  private queue: Promise<unknown> = Promise.resolve();
  private readonly deviceId: Promise<string>;

  constructor(private readonly options: SyncManagerOptions) {
    this.tracked = new TrackedMatches(options.db);
    this.syncStates = new SyncStates(options.db);
    this.pendingChanges = options.pending;
    this.reference = new ReferenceSync({
      db: options.db,
      client: options.client,
      waitForLeadership: options.waitForLeadership ?? true,
      retryTime: options.retryTime ?? DEFAULT_RETRY_MS,
    });
    this.deviceId = options.platform.getDeviceId();
    // Never paused: RxDB's own retry waits for the connection. Coming back only re-syncs.
    this.platformSubscriptions = [
      options.platform.connectivity$
        .pipe(
          distinctUntilChanged(),
          filter((online) => online)
        )
        .subscribe(() => this.resume()),
      options.platform.foreground$.subscribe(() => this.resume()),
    ];
  }

  get userId(): string | null {
    return this.user?.id ?? null;
  }

  isTracking(matchId: string): boolean {
    return this.matches.has(matchId);
  }

  /** A refreshed profile for the same user (same memberships) changes nothing. */
  setUser(user: SyncUser | null): Promise<void> {
    return this.enqueue(async () => {
      if (sameSyncUser(user, this.user)) {
        this.user = user;
        return;
      }
      if (user && this.user && user.id === this.user.id) {
        this.user = user;
        await this.reference.stop();
        this.reference.start(user);
        return;
      }
      await this.stopAll();
      this.user = user;
      if (user) await this.startAll(user);
    });
  }

  /**
   * Tracks the match on this device and waits for its first pull. Resolves
   * true at once if the match was already synced here, false after `timeoutMs`.
   */
  async syncMatch(matchId: string, timeoutMs: number = SYNC_TIMEOUT_MS): Promise<boolean> {
    const user = this.user;
    if (!user) return false;
    const alreadySynced = (await this.syncStates.get(matchId))?.status === "synced";
    if (!alreadySynced) await this.syncStates.set(matchId, "syncing");
    await this.tracked.track(matchId, user.id);
    await this.enqueue(async () => this.reconcile(await this.tracked.get()));
    if (alreadySynced) {
      this.matches.get(matchId)?.reSync();
      return true;
    }
    return this.syncStates.waitForSynced(matchId, timeoutMs);
  }

  retryRejected(matchId?: string): Promise<number> {
    return this.pendingChanges.retryRejected(this.options.db, matchId);
  }

  async awaitMatchInSync(matchId: string): Promise<void> {
    await this.matches.get(matchId)?.awaitInSync();
  }

  async destroy(): Promise<void> {
    this.platformSubscriptions.forEach((subscription) => subscription.unsubscribe());
    await this.enqueue(() => this.stopAll());
  }

  private async startAll(user: SyncUser): Promise<void> {
    this.reference.start(user);
    await runSyncUpgrade(this.options.db, this.tracked, user.id);
    await this.pruneTracked(user.id);
    this.trackedSubscription = this.tracked.get$().subscribe((matches) => {
      void this.enqueue(() => this.reconcile(matches));
    });
    void this.options.platform.requestPersistentStorage();
  }

  private async stopAll(): Promise<void> {
    this.trackedSubscription?.unsubscribe();
    this.trackedSubscription = null;
    const syncs = [...this.matches.values()];
    this.matches.clear();
    await Promise.all(syncs.map((sync) => sync.cancel()));
    await this.reference.stop();
  }

  /** Starts replications for the user's tracked matches and stops the others. */
  private async reconcile(matches: TrackedMatchMap): Promise<void> {
    const user = this.user;
    if (!user) return;
    const wanted = new Set(
      Object.entries(matches)
        .filter(([, entry]) => entry.userId === user.id && entry.claim !== "lost")
        .map(([matchId]) => matchId)
    );
    for (const [matchId, sync] of [...this.matches]) {
      if (wanted.has(matchId)) continue;
      this.matches.delete(matchId);
      await sync.cancel();
    }
    const deviceId = await this.deviceId;
    for (const matchId of wanted) {
      if (this.matches.has(matchId)) continue;
      const sync = new MatchSync(matchId, {
        db: this.options.db,
        client: this.options.client,
        pending: this.pendingChanges,
        deviceId,
        claim: this.claimCheck,
        onSuperseded: (id) => this.onSuperseded(id),
        onSynced: (id) => this.syncStates.set(id, "synced"),
        waitForLeadership: this.options.waitForLeadership ?? true,
        retryTime: this.options.retryTime ?? DEFAULT_RETRY_MS,
      });
      this.matches.set(matchId, sync);
      sync.start();
    }
  }

  /** Drops matches unopened for TRACKED_MATCH_TTL_MS once nothing of theirs is unsent. */
  private async pruneTracked(userId: string): Promise<void> {
    const cutoff = Date.now() - TRACKED_MATCH_TTL_MS;
    for (const [matchId, entry] of Object.entries(await this.tracked.get())) {
      if (entry.userId !== userId || Date.parse(entry.lastOpenedAt) >= cutoff) continue;
      if ((await this.pendingChanges.count({ matchId, statuses: ["pending", "rejected"] })) === 0) {
        await this.tracked.remove(matchId);
      }
    }
  }

  private resume(): void {
    this.reference.reSync();
    for (const sync of this.matches.values()) sync.reSync();
  }

  private readonly claimCheck: ClaimCheck = async (matchId) =>
    (await this.tracked.entry(matchId))?.claim === "lost" ? "lost" : "ok";

  private async onSuperseded(matchId: string): Promise<void> {
    await this.markLost(matchId, null);
  }

  private async markLost(matchId: string, holder: ScorerInfo | null): Promise<void> {
    if ((await this.tracked.entry(matchId))?.claim === "lost") return;
    await this.pendingChanges.supersedeMatch(matchId);
    await this.tracked.setClaim(matchId, "lost", holder);
  }

  /** Serializes lifecycle changes within this tab. */
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return run;
  }
}
