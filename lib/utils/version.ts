const VERSION = /^\d+(\.\d+)*$/;

/** Compares dotted version numbers; a missing part counts as 0 ("1.4" = "1.4.0"). `null` when either is not a plain dotted number. */
export function compareVersions(a: string, b: string): -1 | 0 | 1 | null {
  if (!VERSION.test(a) || !VERSION.test(b)) return null;
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const x = left[i] ?? 0;
    const y = right[i] ?? 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

export type UpdateStatus = "ok" | "available" | "required";

/** Never `required` or `available` without data: an unreadable config must not lock anyone out. */
export function updateStatus(
  current: string | null,
  config: { min_version: string; latest_version: string } | null,
): UpdateStatus {
  if (current === null || config === null) return "ok";
  const againstMin = compareVersions(current, config.min_version);
  const againstLatest = compareVersions(current, config.latest_version);
  if (againstMin === null || againstLatest === null) return "ok";
  if (againstMin < 0) return "required";
  if (againstLatest < 0) return "available";
  return "ok";
}

/** What to show. A live match is never interrupted: neither the block nor the banner shows on the live page; they wait until it is left. */
export function updateUi(
  status: UpdateStatus,
  { onLivePage, bannerDismissed }: { onLivePage: boolean; bannerDismissed: boolean },
): "none" | "banner" | "block" {
  if (onLivePage) return "none";
  if (status === "required") return "block";
  if (status === "available") return bannerDismissed ? "none" : "banner";
  return "none";
}
