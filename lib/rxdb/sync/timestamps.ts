const ISO_TIMESTAMP = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:?\d{2})$/;

/**
 * Microseconds since the epoch for a full ISO-8601 timestamp, or null if
 * `value` isn't one. Keeps the microseconds Postgres returns, which
 * `Date.parse` drops.
 */
export function isoToMicros(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = ISO_TIMESTAMP.exec(value);
  if (!match) return null;
  const [, seconds, fraction = "", zone] = match;
  const offset = zone === "Z" || zone.includes(":") ? zone : `${zone.slice(0, 3)}:${zone.slice(3)}`;
  const base = Date.parse(`${seconds}${offset}`);
  if (Number.isNaN(base)) return null;
  return base * 1000 + Number(fraction.slice(0, 6).padEnd(6, "0"));
}
