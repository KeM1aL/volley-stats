export enum TeamMemberRole {
  PLAYER = "player",
  COACH = "coach",
  OWNER = "owner",
  STAFF = "staff"
}

export enum PlayerRole {
  SETTER = "setter",
  OPPOSITE = "opposite",
  OUTSIDE_HITTER = "outside_hitter",
  MIDDLE_HITTER = "middle_hitter",
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
  RECEPTION = "reception",
  SPIKE = "spike",
  BLOCK = "block",
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

export enum ChampionshipType {
  REGIONAL = "regional",
  DEPARTMENTAL = "departmental",
  NATIONAL = "national",
}

export enum ChampionshipFormat {
  TWO_X_TWO = "2x2",
  THREE_X_THREE = "3x3",
  FOUR_X_FOUR = "4x4",
  SIX_X_SIX = "6x6",
}

export enum ChampionshipAgeCategory {
  U10 = "U10",
  U12 = "U12",
  U14 = "U14",
  U16 = "U16",
  U18 = "U18",
  U21 = "U21",
  SENIOR = "senior",
}

export enum ChampionshipGender {
  MALE = "male",
  FEMALE = "female",
}

export type Score = {
  home: number,
  away: number,
}
