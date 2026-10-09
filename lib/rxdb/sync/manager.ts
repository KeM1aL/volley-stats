import type { SupabaseClient } from "@supabase/supabase-js";
import { BehaviorSubject, distinctUntilChanged, filter, firstValueFrom, of, timeout, type Subscription } from "rxjs";
import type { User } from "@/lib/types";
import type { LocalDatabase } from "../collections";
import type { ClaimCheck } from "./dependencies";
import { MatchSync } from "./match-sync";
import type { PendingChanges } from "./pending-changes";
import type { SyncPlatform } from "./platform/types";
import { ReferenceSync } from "./reference-sync";
import { claimMatchScorer, getMatchScorer, isClaimForbidden, type ClaimResult, type ScorerInfo } from "./scorer-claim";
import { SyncStates } from "./sync-state";
import { discardSupersededChanges } from "./take-back";
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
  /** Mirrors `user`, so a screen that asks for a match before sign-in completes can wait for it. */
  private readonly user$ = new BehaviorSubject<SyncUser | null>(null);
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
        this.assignUser(user);
        return;
      }
      if (user && this.user && user.id === this.user.id) {
        this.assignUser(user);
        await this.reference.stop();
        this.reference.start(user);
        return;
      }
      await this.stopAll();
      this.assignUser(user);
      if (user) await this.startAll(user);
    });
  }

  /**
   * Tracks the match on this device and waits for its first pull. Resolves
   * true at once if the match was already synced here, false after `timeoutMs`.
   */
  async syncMatch(matchId: string, timeoutMs: number = SYNC_TIMEOUT_MS): Promise<boolean> {
    const user =
      this.user ??
      (await firstValueFrom(
        this.user$.pipe(
          filter((candidate): candidate is SyncUser => candidate !== null),
          timeout({ first: timeoutMs, with: () => of(null) })
        )
      ));
    if (!user) return false;
    const alreadySynced = (await this.syncStates.get(matchId))?.status === "synced";
    // Another account's unsent changes to it: that account keeps it (the badge shows them).
    if (!(await this.trackFor(matchId, user.id))) return alreadySynced;
    if (!alreadySynced) await this.syncStates.set(matchId, "syncing");
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

  /** Claims the match for this device (spec section 7). Throws ScorerRpcError when the server can't be reached. */
  async claimMatch(matchId: string, force = false): Promise<ClaimResult> {
    const user = this.user;
    const trackedBefore = (await this.tracked.entry(matchId)) !== null;
    const tracked = user ? await this.trackFor(matchId, user.id) : true;
    let result: ClaimResult;
    try {
      result = await claimMatchScorer(this.options.client, {
        matchId,
        deviceId: await this.deviceId,
        label: this.options.platform.getDeviceLabel(),
        force,
      });
    } catch (error) {
      // Refused (no right to score it, or no such match): a match tracked only for this claim isn't replicated.
      if (!trackedBefore && isClaimForbidden(error)) await this.tracked.remove(matchId);
      throw error;
    }
    // The claim state belongs to the account the match is tracked for.
    if (result.claimed && tracked) await this.tracked.setClaim(matchId, "held");
    return result;
  }

  /**
   * Takes scoring back after another device took the match over (the banner). Forces the claim, then
   * discards this device's superseded changes to the match so it shows the match as the server has it
   * (controller ruling, closing review N1), and only then marks the claim held: the replications restart
   * on aligned rows. Finally pulls the match again (`refreshed` false: the refresh timed out).
   * Throws ScorerRpcError when the claim fails, or the server's error when its rows can't be read;
   * the claim then stays lost on this device and the take-back can be tried again.
   */
  async takeBackMatch(matchId: string): Promise<{ claim: ClaimResult; refreshed: boolean }> {
    const claim = await this.enqueue(async () => {
      // Normally already stopped by the loss; nothing of this match may push while it is reset.
      const running = this.matches.get(matchId);
      if (running) {
        this.matches.delete(matchId);
        await running.cancel();
      }
      if (this.user) await this.tracked.track(matchId, this.user.id);
      const deviceId = await this.deviceId;
      const result = await claimMatchScorer(this.options.client, {
        matchId,
        deviceId,
        label: this.options.platform.getDeviceLabel(),
        force: true,
      });
      if (!result.claimed) return result;
      await discardSupersededChanges({
        db: this.options.db,
        client: this.options.client,
        pending: this.pendingChanges,
        deviceId,
        matchId,
      });
      await this.tracked.setClaim(matchId, "held");
      return result;
    });
    return { claim, refreshed: claim.claimed ? await this.refreshMatch(matchId) : false };
  }

  /** Scoring offline without being able to check: the claim is forced before the match's first upload. */
  async claimMatchOffline(matchId: string): Promise<void> {
    if (this.user && !(await this.trackFor(matchId, this.user.id))) return;
    // A lost claim is only taken back online: takeBackMatch must discard the superseded changes first.
    if ((await this.tracked.entry(matchId))?.claim === "lost") return;
    await this.tracked.setClaim(matchId, "pending-force");
  }

  /** Has another device taken over a match this device holds? */
  async checkClaims(): Promise<void> {
    const user = this.user;
    if (!user) return;
    const deviceId = await this.deviceId;
    for (const [matchId, entry] of Object.entries(await this.tracked.get())) {
      if (entry.userId !== user.id || entry.claim !== "held") continue;
      try {
        const holder = await getMatchScorer(this.options.client, matchId, deviceId);
        if (holder.deviceId && holder.deviceId !== deviceId) await this.markLost(matchId, holder);
      } catch {
        // Offline: checked again on the next resume.
      }
    }
  }

  /**
   * Pulls the match again and waits until its replications are in sync, e.g. after a
   * forced takeover, so rows the previous device pushed are here before scoring.
   * Resolves false if that takes longer than `timeoutMs` (offline) or the match isn't replicated.
   */
  async refreshMatch(matchId: string, timeoutMs = 10_000): Promise<boolean> {
    // A claim that was just taken back restarts the replications through the tracked$ subscription.
    await this.enqueue(async () => this.reconcile(await this.tracked.get()));
    const sync = this.matches.get(matchId);
    if (!sync) return false;
    sync.reSync();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<false>((resolve) => {
      timer = setTimeout(() => resolve(false), timeoutMs);
    });
    try {
      return await Promise.race([sync.awaitInSync().then(() => true, () => false), timedOut]);
    } finally {
      clearTimeout(timer);
    }
  }

  async awaitMatchInSync(matchId: string): Promise<void> {
    await this.matches.get(matchId)?.awaitInSync();
  }

  async destroy(): Promise<void> {
    this.platformSubscriptions.forEach((subscription) => subscription.unsubscribe());
    await this.enqueue(() => this.stopAll());
  }

  private assignUser(user: SyncUser | null): void {
    this.user = user;
    this.user$.next(user);
  }

  private async startAll(user: SyncUser): Promise<void> {
    this.reference.start(user);
    // Subscribed first: the upgrade and the pruning are best effort and must not keep matches from replicating.
    this.trackedSubscription = this.tracked.get$().subscribe((matches) => {
      void this.enqueue(() => this.reconcile(matches));
    });
    try {
      await runSyncUpgrade(this.options.db, this.tracked, this.pendingChanges, user.id, this.options.client);
    } catch (error) {
      console.warn("[sync] upgrade seeding failed:", error);
    }
    try {
      await this.pruneTracked(user.id);
    } catch (error) {
      console.warn("[sync] pruning tracked matches failed:", error);
    }
    void this.options.platform.requestPersistentStorage();
  }

  private async stopAll(): Promise<void> {
    this.trackedSubscription?.unsubscribe();
    this.trackedSubscription = null;
    const syncs = [...this.matches.values()];
    this.matches.clear();
    const results = await Promise.allSettled(syncs.map((sync) => sync.cancel()));
    for (const result of results) {
      if (result.status === "rejected") console.warn("[sync] stopping a match replication failed:", result.reason);
    }
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

  /**
   * Tracks the match for this user, unless the tracked entry belongs to another account and that
   * account's changes to the match are still unsent on this device: it keeps the match then (they
   * must not upload under this account). Returns whether the match is tracked for this user.
   */
  private async trackFor(matchId: string, userId: string): Promise<boolean> {
    const entry = await this.tracked.entry(matchId);
    if (entry && entry.userId !== userId) {
      const unsent = await this.pendingChanges.count({ matchId, statuses: ["pending", "rejected"] });
      if (unsent > 0) return false;
    }
    await this.tracked.track(matchId, userId);
    return true;
  }

  /**
   * Drops matches unopened for TRACKED_MATCH_TTL_MS once nothing of theirs is unsent. Superseded
   * changes keep a lost match too: taking scoring back must still discard them.
   */
  private async pruneTracked(userId: string): Promise<void> {
    const cutoff = Date.now() - TRACKED_MATCH_TTL_MS;
    for (const [matchId, entry] of Object.entries(await this.tracked.get())) {
      if (entry.userId !== userId || Date.parse(entry.lastOpenedAt) >= cutoff) continue;
      if ((await this.pendingChanges.count({ matchId, statuses: ["pending", "rejected", "superseded"] })) === 0) {
        await this.tracked.remove(matchId);
      }
    }
  }

  private resume(): void {
    this.reference.reSync();
    for (const sync of this.matches.values()) sync.reSync();
    void this.checkClaims();
  }

  private readonly claiming = new Map<string, Promise<"ok" | "unavailable">>();

  private readonly claimCheck: ClaimCheck = async (matchId) => {
    const entry = await this.tracked.entry(matchId);
    if (!entry || entry.claim === null || entry.claim === "held") return "ok";
    if (entry.claim === "lost") return "lost";
    // pending-force: one RPC at a time per match, shared by the five replications.
    let inFlight = this.claiming.get(matchId);
    if (!inFlight) {
      inFlight = this.claimMatch(matchId, true)
        .then(
          (result): "ok" | "unavailable" => (result.claimed ? "ok" : "unavailable"),
          (): "unavailable" => "unavailable"
        )
        .finally(() => this.claiming.delete(matchId));
      this.claiming.set(matchId, inFlight);
    }
    return inFlight;
  };

  private readonly superseding = new Map<string, Promise<void>>();

  /** A row was refused because another device scores the match: one check at a time per match. */
  private onSuperseded(matchId: string): Promise<void> {
    let inFlight = this.superseding.get(matchId);
    if (!inFlight) {
      inFlight = this.checkSuperseded(matchId).finally(() => this.superseding.delete(matchId));
      this.superseding.set(matchId, inFlight);
    }
    return inFlight;
  }

  private async checkSuperseded(matchId: string): Promise<void> {
    // Already lost: the rest of a burst of superseded rows has nothing new to ask the server.
    if ((await this.tracked.entry(matchId))?.claim === "lost") return;
    const deviceId = await this.deviceId;
    let holder: ScorerInfo | null = null;
    try {
      holder = await getMatchScorer(this.options.client, matchId, deviceId);
    } catch {
      // A held claim isn't given up on a guess: the next resume's checkClaims decides.
      if ((await this.tracked.entry(matchId))?.claim === "held") return;
      // Otherwise the banner shows "another scorer" without a name.
    }
    // This device holds the match (e.g. a row behind a parent superseded before a take-back): not lost.
    if (holder?.deviceId === deviceId) return;
    await this.markLost(matchId, holder);
  }

  private async markLost(matchId: string, holder: ScorerInfo | null): Promise<void> {
    if ((await this.tracked.entry(matchId))?.claim === "lost") return;
    await this.pendingChanges.supersedeMatch(matchId);
    await this.tracked.setClaim(matchId, "lost", holder);
  }

  /** Serializes lifecycle changes within this tab. */
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.catch((error) => console.warn("[sync] lifecycle task failed:", error));
    return run;
  }
}
