export interface Ratio {
  made: number;
  of: number;
  /** Rounded percentage, or null when `of` is 0. */
  pct: number | null;
}

export function ratio(made: number, of: number): Ratio {
  return { made, of, pct: of === 0 ? null : Math.round((made / of) * 100) };
}
