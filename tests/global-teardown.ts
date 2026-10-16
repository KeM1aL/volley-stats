import { cleanupE2eDataAsTestUser } from './helpers/e2e-cleanup';
import { deleteThrowawayUsers } from './helpers/throwaway-user';

/** Runs once after the whole suite (pass or fail): remove the data the specs created. */
export default async function globalTeardown() {
  if (process.env.E2E_KEEP_DATA) {
    console.log('E2E_KEEP_DATA set: leaving e2e data in Supabase');
    return;
  }
  // First: the throwaway accounts' teams are also named "E2E Team …", and only the service role can delete them.
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const removed = await deleteThrowawayUsers();
    console.log(`e2e cleanup: removed ${removed} throwaway users`);
  }
  const report = await cleanupE2eDataAsTestUser();
  const total = Object.values(report).reduce((sum, n) => sum + n, 0);
  console.log(`e2e cleanup: deleted ${total} rows`, report);
}
