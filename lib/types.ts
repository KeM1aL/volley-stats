export enum PlayerPosition {
  SETTER = "Setter",
  OPPOSITE = "Opposite",
  OUTSIDE_FRONT = "Outside Hitter (Front)",
  OUTSIDE_BACK = "Outside Hitter (Back)",
  MIDDLE_FRONT = "Middle Blocker (Front)",
  MIDDLE_BACK = "Middle Blocker (Back)",
  LIBERO = "Libero",
}

export enum PointType {
  SERVE = "serve",
  SPIKE = "spike",
  BLOCK = "block",
  OPPONENT_ERROR = "opponent_error",
}

export enum StatType {
  SERVE = "serve",
  SPIKE = "spike",
  BLOCK = "block",
  RECEPTION = "reception",
}

export enum StatResult {
  ERROR = "error",
  ATTEMPT = "attempt",
  SUCCESS = "success",
}

export enum MatchStatus {
  UPCOMING = "upcoming",
  LIVE = "live",
  COMPLETED = "completed",
}

export type Score = {
  home: number,
  away: number,
}