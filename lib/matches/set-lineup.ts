import { PlayerPosition, PlayerRole } from "@/lib/enums";

/** Roles a player on court can have (the role select's options): every PlayerRole except LIBERO. */
export const FIELD_ROLES: readonly PlayerRole[] = [
  PlayerRole.SETTER,
  PlayerRole.OPPOSITE,
  PlayerRole.OUTSIDE_HITTER,
  PlayerRole.MIDDLE_HITTER,
];

export interface SetLineup {
  /** Player id at each court position. */
  positions: Partial<Record<PlayerPosition, string>>;
  /** Role of each player on court, by player id. A player on court may have no entry (role missing). */
  roles: Record<string, PlayerRole>;
  /** The libero (not on court), or null. */
  liberoId: string | null;
}

export const emptyLineup: SetLineup = { positions: {}, roles: {}, liberoId: null };

const isFieldRole = (role: unknown): role is PlayerRole =>
  FIELD_ROLES.includes(role as PlayerRole);

/** The player's default position as a role, only if it is a field role; otherwise null. */
export function defaultFieldRole(position: string | null | undefined): PlayerRole | null {
  return isFieldRole(position) ? position : null;
}

/** Removes the player from the court (position and role). */
function withoutPlayer(lineup: SetLineup, playerId: string): SetLineup {
  const positions = { ...lineup.positions };
  for (const position of Object.keys(positions) as PlayerPosition[]) {
    if (positions[position] === playerId) delete positions[position];
  }
  const roles = { ...lineup.roles };
  delete roles[playerId];
  return { ...lineup, positions, roles };
}

/** Puts the player at the position. The previous player at that position leaves the court and loses
 *  their role. The player leaves any other position and stops being the libero. The role is
 *  defaultFieldRole(defaultPosition), or none. */
export function placePlayer(
  lineup: SetLineup,
  position: PlayerPosition,
  playerId: string,
  defaultPosition: string | null | undefined
): SetLineup {
  const previousId = lineup.positions[position];
  let next = withoutPlayer(lineup, playerId);
  if (previousId) next = withoutPlayer(next, previousId);
  const role = defaultFieldRole(defaultPosition);
  return {
    positions: { ...next.positions, [position]: playerId },
    roles: role ? { ...next.roles, [playerId]: role } : next.roles,
    liberoId: lineup.liberoId === playerId ? null : lineup.liberoId,
  };
}

export function clearPosition(lineup: SetLineup, position: PlayerPosition): SetLineup {
  const playerId = lineup.positions[position];
  return playerId ? withoutPlayer(lineup, playerId) : { ...lineup };
}

/** Sets the role of the player at the position (no-op if the position is empty). Only FIELD_ROLES are accepted. */
export function setRole(lineup: SetLineup, position: PlayerPosition, role: PlayerRole): SetLineup {
  const playerId = lineup.positions[position];
  if (!playerId || !isFieldRole(role)) return lineup;
  return { ...lineup, roles: { ...lineup.roles, [playerId]: role } };
}

/** Sets or clears the libero. A player on court can't become libero (returns the lineup unchanged). */
export function setLibero(lineup: SetLineup, playerId: string | null): SetLineup {
  if (playerId !== null && Object.values(lineup.positions).includes(playerId)) return lineup;
  return { ...lineup, liberoId: playerId };
}

export function roleAt(lineup: SetLineup, position: PlayerPosition): PlayerRole | null {
  const playerId = lineup.positions[position];
  return (playerId && lineup.roles[playerId]) || null;
}

/** Positions among `existing` that have a player but no role, in `existing` order. */
export function positionsMissingRole(
  lineup: SetLineup,
  existing: readonly PlayerPosition[]
): PlayerPosition[] {
  return existing.filter((position) => lineup.positions[position] && !roleAt(lineup, position));
}

/** Positions among `existing` with no player. */
export function emptyPositions(
  lineup: SetLineup,
  existing: readonly PlayerPosition[]
): PlayerPosition[] {
  return existing.filter((position) => !lineup.positions[position]);
}

/** `player_roles` for the set: one entry per player on an existing position, plus the libero as LIBERO. */
export function toPlayerRoles(
  lineup: SetLineup,
  existing: readonly PlayerPosition[]
): Record<string, PlayerRole> {
  const result: Record<string, PlayerRole> = {};
  for (const position of existing) {
    const playerId = lineup.positions[position];
    const role = roleAt(lineup, position);
    if (playerId && role) result[playerId] = role;
  }
  if (lineup.liberoId) result[lineup.liberoId] = PlayerRole.LIBERO;
  return result;
}

const POSITIONS_BY_FORMAT: Record<string, PlayerPosition[]> = {
  "3x3": [PlayerPosition.P1, PlayerPosition.P2, PlayerPosition.P3],
  "4x4": [PlayerPosition.P1, PlayerPosition.P2, PlayerPosition.P3, PlayerPosition.P4],
  "6x6": [
    PlayerPosition.P1,
    PlayerPosition.P2,
    PlayerPosition.P3,
    PlayerPosition.P4,
    PlayerPosition.P5,
    PlayerPosition.P6,
  ],
};

/** The positions that exist in a format ("2x2" → P1, P2; "3x3" → P1–P3; "4x4" → P1–P4; "6x6" → P1–P6). */
export function existingPositions(format: string | undefined): PlayerPosition[] {
  return [...(POSITIONS_BY_FORMAT[format ?? ""] ?? [PlayerPosition.P1, PlayerPosition.P2])];
}
