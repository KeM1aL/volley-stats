import { cleanupE2eDataAsTestUser } from './helpers/e2e-cleanup';

/** Runs once after the whole suite (pass or fail): remove the data the specs created. */
export default async function globalTeardown() {
  if (process.env.E2E_KEEP_DATA) {
    console.log('E2E_KEEP_DATA set: leaving e2e data in Supabase');
    return;
  }
  const report = await cleanupE2eDataAsTestUser();
  const total = Object.values(report).reduce((sum, n) => sum + n, 0);
  console.log(`e2e cleanup: deleted ${total} rows`, report);
}
