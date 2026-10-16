/**
 * Why the live page couldn't load a match. The page then leaves for the match list and says why
 * (`matches.live.leftReasons.<reason>`), so the user never lands on the list without a reason.
 */
export type LiveLoadFailureReason =
  /** The URL has no ?team= (the team this device scores for). */
  | "missingTeam"
  /** Not on this device, and it is offline: the match was never opened here while online. */
  | "notOnDevice"
  /** Not on this device: the download didn't finish (timeout, server error). */
  | "notDownloaded"
  /** Downloaded, yet not there: deleted, or not visible to this user. */
  | "matchNotFound"
  /** Its match format or teams are missing on this device. */
  | "dataMissing"
  /** The ?team= of the URL doesn't play in this match. */
  | "teamNotInMatch"
  /** Anything unexpected (local database error, ...). */
  | "unknown";

export class LiveLoadError extends Error {
  constructor(readonly reason: LiveLoadFailureReason) {
    super(`live match could not be loaded: ${reason}`);
    this.name = "LiveLoadError";
  }
}

export function liveLoadFailureReason(error: unknown): LiveLoadFailureReason {
  return error instanceof LiveLoadError ? error.reason : "unknown";
}

/** The match isn't in the local database: why, from whether the device was online and the download finished. */
export function missingMatchReason({ online, synced }: { online: boolean; synced: boolean }): LiveLoadFailureReason {
  if (!online) return "notOnDevice";
  return synced ? "matchNotFound" : "notDownloaded";
}
