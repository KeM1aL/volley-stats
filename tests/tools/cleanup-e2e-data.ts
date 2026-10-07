/**
 * Delete leftover e2e data from the shared Supabase project.
 * Usage: pnpm test:e2e:cleanup [--dry-run]
 */
import { config } from 'dotenv';
import { cleanupE2eDataAsTestUser } from '../helpers/e2e-cleanup';

for (const path of ['.env.test', '.env.test.local', '.env.local', '.env']) {
  config({ path, quiet: true });
}

const dryRun = process.argv.includes('--dry-run');
cleanupE2eDataAsTestUser({ dryRun })
  .then((report) => {
    console.log(dryRun ? 'Would delete:' : 'Deleted:');
    console.table(report);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
