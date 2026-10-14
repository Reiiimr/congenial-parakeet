import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { seedMockSimulationData } from './mock-simulation-data.mjs';

const database = new PGlite('./.local-test-db', { extensions: { pgcrypto } });
try {
  await database.waitReady;
  const result = await seedMockSimulationData(database);
  console.log(`Mock simulation ${result.seeded ? 'seeded' : 'already present'}: ${result.records} records and ${result.submissions} census submissions.`);
} finally {
  await database.close();
}
