export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function waitFor(
  check: () => boolean | Promise<boolean>,
  { timeoutMs = 8000, intervalMs = 20, message = "condition" }: { timeoutMs?: number; intervalMs?: number; message?: string } = {}
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await sleep(intervalMs);
  }
  throw new Error(`Timed out after ${timeoutMs} ms waiting for ${message}`);
}

/**
 * Proves something does NOT happen: `check` must stay true for the whole window. Fails as soon as it
 * turns false, naming what changed. Use instead of `sleep(ms); expect(...)`.
 */
export async function holdsFor(
  check: () => boolean | Promise<boolean>,
  windowMs: number,
  message: string
): Promise<void> {
  const deadline = Date.now() + windowMs;
  do {
    if (!(await check())) throw new Error(`Expected ${message} to hold for ${windowMs} ms`);
    await sleep(20);
  } while (Date.now() < deadline);
}
