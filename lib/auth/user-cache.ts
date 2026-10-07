import type { User } from "@/lib/types";

// The signed-in user (profile + memberships) saved on this device so the app
// can start offline. Written after every successful profile load, read only
// when the network is unavailable, removed when the device has no session.
const CACHE_KEY = "volleystats:cached-user";

type CachedUser = {
  userId: string;
  savedAt: string;
  user: User;
};

export function saveCachedUser(user: User): void {
  try {
    const entry: CachedUser = { userId: user.id, savedAt: new Date().toISOString(), user };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch (error) {
    // Storage full or unavailable (private mode): offline start just won't be possible.
    console.warn("Could not save the user for offline use:", error);
  }
}

/** The saved user, only if it belongs to `userId` (the current session's user). */
export function loadCachedUser(userId: string): User | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CachedUser;
    return entry.userId === userId && entry.user?.id === userId ? entry.user : null;
  } catch {
    return null;
  }
}

export function clearCachedUser(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // Storage unavailable: nothing was saved.
  }
}

/** True when a failed request looks like "no network" rather than a server error. */
export function isNetworkFailure(error: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /failed to fetch|networkerror|network request failed|load failed/i.test(message);
}
