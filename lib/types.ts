export enum PlayerRole {
  SETTER = "Setter",
  OPPOSITE = "Opposite",
  OUTSIDE_FRONT = "Outside Hitter (Front)",
  OUTSIDE_BACK = "Outside Hitter (Back)",
  MIDDLE_FRONT = "Middle Blocker (Front)",
  MIDDLE_BACK = "Middle Blocker (Back)",
  LIBERO = "Libero",
}

export enum PlayerPosition {
  P1 = "p1",
  P2 = "p2",
  P3 = "p3",
  P4 = "p4",
  P5 = "p5",
  P6 = "p6",
}

export enum PointType {
  SERVE = "serve",
  SPIKE = "spike",
  BLOCK = "block",
  RECEPTION = "reception",
  DEFENSE = "defense",
  UNKNOWN = "unknown",
}

export enum StatType {
  SERVE = "serve",
  SPIKE = "spike",
  BLOCK = "block",
  RECEPTION = "reception",
  DEFENSE = "defense",
}

export enum StatResult {
  ERROR = "error",
  BAD = "bad",
  GOOD = "good",
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