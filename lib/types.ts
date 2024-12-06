export enum PlayerRole {
  SETTER = "setter",
  OPPOSITE = "opposite",
  OUTSIDE_FRONT = "outside_front",
  OUTSIDE_BACK = "outside_back",
  MIDDLE_FRONT = "middle_front",
  MIDDLE_BACK = "middle_back",
  LIBERO = "libero",
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