import { test as setup } from '@playwright/test';
import { writeFixture } from '../helpers/fixture';
import { seedTeam } from '../helpers/seed';

setup('seed the run team', async () => {
  const runId = String(Date.now());
  writeFixture({ runId, ...(await seedTeam(runId)) });
});
