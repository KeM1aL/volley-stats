/** The hint asks a touch device held in portrait to turn; once dismissed it stays away for that match. */
export function shouldShowLandscapeHint(state: { portrait: boolean; coarsePointer: boolean; dismissed: boolean }): boolean {
  return state.portrait && state.coarsePointer && !state.dismissed;
}

/** Storage key under which the dismissal of the hint is remembered, per match. */
export function landscapeHintKey(matchId: string): string {
  return `volleystats:landscape-hint-dismissed:${matchId}`;
}
