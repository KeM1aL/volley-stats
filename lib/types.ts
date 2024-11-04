export enum PlayerPosition {
  SETTER = "Setter",
  OPPOSITE = "Opposite",
  OUTSIDE_FRONT = "Outside Hitter (Front)",
  OUTSIDE_BACK = "Outside Hitter (Back)",
  MIDDLE_FRONT = "Middle Blocker (Front)",
  MIDDLE_BACK = "Middle Blocker (Back)",
  LIBERO = "Libero",
}

export enum StatType {
  SERVE = "serve",
  ATTACK = "attack",
  BLOCK = "block",
  RECEPTION = "reception",
}

export enum StatResult {
  SUCCESS = "success",
  ERROR = "error",
  ATTEMPT = "attempt",
}