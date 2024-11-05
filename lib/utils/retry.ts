const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_INITIAL_DELAY = 1000;

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = DEFAULT_MAX_RETRIES,
  initialDelay: number = DEFAULT_INITIAL_DELAY
): Promise<T> {
  let retries = 0;
  let delay = initialDelay;

  while (true) {
    try {
      return await fn();
    } catch (error) {
      if (retries >= maxRetries) {
        throw error;
      }

      retries++;
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }
}