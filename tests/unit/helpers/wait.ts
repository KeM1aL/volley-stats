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
