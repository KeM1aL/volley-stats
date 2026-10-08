// The number of unsent changes, mirrored in localStorage so the database reset
// guard (lib/rxdb/database.ts) can read it even when the database can't open.
const HINT_KEY = "volleystats:unsent-changes";

type HintStorage = { getItem(key: string): string | null; setItem(key: string, value: string): void };

function browserStorage(): HintStorage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function writeUnsentHint(count: number, storage: HintStorage | null = browserStorage()): void {
  try {
    storage?.setItem(HINT_KEY, String(count));
  } catch {
    // Storage full or unavailable: the reset guard then falls back to 0.
  }
}

export function readUnsentHint(storage: HintStorage | null = browserStorage()): number {
  try {
    const value = Number(storage?.getItem(HINT_KEY) ?? 0);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}
