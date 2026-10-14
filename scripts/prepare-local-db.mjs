import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFile } from 'node:fs/promises';
import { seedMockSimulationData } from './mock-simulation-data.mjs';

const database = new PGlite('./.local-test-db', { extensions: { pgcrypto } });
const migrations = [
  '000_ekapon_schema.sql',
  '001_create_api_role.sql',
  '005_census_submissions.sql',
  '006_census_submitter_retention.sql',
  '008_profile_preferences_undo.sql',
];

try {
  await database.waitReady;
  const [{ exists }] = (await database.query("select to_regclass('ekapon.accounts') is not null as exists")).rows;
  if (!exists) {
    for (const file of migrations) {
      await database.exec(await readFile(`db/${file}`, 'utf8'));
      console.log(`Applied ${file}`);
    }
    const operations = await readFile('db/007_operations.sql', 'utf8');
    const partTwo = operations.indexOf('-- ======================= PART 2');
    if (partTwo < 0) throw new Error('Could not find the Part 2 marker in db/007_operations.sql');
    await database.exec(operations.slice(0, partTwo));
    console.log('Applied 007_operations.sql Part 1');
    await database.exec(operations.slice(partTwo));
    console.log('Applied 007_operations.sql Part 2');
    await database.exec(await readFile('db/009_notification_archive.sql', 'utf8'));
    console.log('Applied 009_notification_archive.sql');
    await database.exec(await readFile('db/010_reporting_workflows.sql', 'utf8'));
    console.log('Applied 010_reporting_workflows.sql');
  } else {
    console.log('Local schema already exists; leaving it in place.');
    await database.exec(await readFile('db/008_profile_preferences_undo.sql', 'utf8'));
    console.log('Ensured 008_profile_preferences_undo.sql');
    await database.exec(await readFile('db/009_notification_archive.sql', 'utf8'));
    console.log('Ensured 009_notification_archive.sql');
    await database.exec(await readFile('db/010_reporting_workflows.sql', 'utf8'));
    console.log('Ensured 010_reporting_workflows.sql');
  }

  const barangayRows = await database.query(
    "insert into ekapon.barangays (acronym, name, district, zip) values ('LOCAL', 'Local Test Barangay', 1, '3023') on conflict (name) do nothing returning id",
  );
  const barangay = barangayRows.rows[0] ?? (await database.query(
    "select id from ekapon.barangays where name = 'Local Test Barangay'",
  )).rows[0];

  const admin = (await database.query(
    "select id from ekapon.accounts where username = 'localadmin'",
  )).rows[0];
  if (!admin) {
    await database.query(
      `insert into ekapon.accounts (username, account_type, first_name, last_name, password_hash)
       values ('localadmin', 'SuperAdmin', 'Local', 'Admin', extensions.crypt('LocalTest!123', extensions.gen_salt('bf', 4)))`,
    );
    console.log('Created test SuperAdmin: localadmin / LocalTest!123');
  }

  const paravet = (await database.query(
    "select id from ekapon.accounts where first_name = 'Local' and last_name = 'Paravet' and account_type = 'Paravet'",
  )).rows[0];
  if (!paravet) {
    await database.query(
      `insert into ekapon.accounts (account_type, first_name, last_name, barangay_id, password_hash)
       values ('Paravet', 'Local', 'Paravet', $1, extensions.crypt('LocalTest!123', extensions.gen_salt('bf', 4)))`,
      [barangay.id],
    );
    console.log('Created test Paravet with the generated account key; password LocalTest!123');
  }
  const [{ account_key: paravetKey }] = (await database.query(
    "select account_key from ekapon.accounts where first_name = 'Local' and last_name = 'Paravet' and account_type = 'Paravet'",
  )).rows;
  console.log(`Paravet account key: ${paravetKey}`);

  const sampleAdmin = (await database.query(
    "select id from ekapon.accounts where username = 'sampleadmin'",
  )).rows[0];
  if (!sampleAdmin) {
    await database.query(
      `insert into ekapon.accounts (username, account_type, first_name, last_name, password_hash)
       values ('sampleadmin', 'Admin', 'Sample', 'Admin', extensions.crypt('ChangeMe-123', extensions.gen_salt('bf', 4)))`,
    );
    console.log('Created test Admin: sampleadmin / ChangeMe-123');
  }

  const sampleParavet = (await database.query(
    "select id from ekapon.accounts where first_name = 'Sample' and last_name = 'Paravet' and account_type = 'Paravet'",
  )).rows[0];
  if (!sampleParavet) {
    await database.query(
      `insert into ekapon.accounts (account_type, first_name, last_name, barangay_id, password_hash)
       values ('Paravet', 'Sample', 'Paravet', $1, extensions.crypt('ChangeMe-123', extensions.gen_salt('bf', 4)))`,
      [barangay.id],
    );
    console.log('Created test Paravet with password ChangeMe-123');
  }
  const [{ account_key: sampleParavetKey }] = (await database.query(
    "select account_key from ekapon.accounts where first_name = 'Sample' and last_name = 'Paravet' and account_type = 'Paravet'",
  )).rows;
  console.log(`Sample Paravet account key: ${sampleParavetKey}`);

  const simulation = await seedMockSimulationData(database);
  console.log(`Mock simulation ${simulation.seeded ? 'seeded' : 'already present'}: ${simulation.records} records and ${simulation.submissions} census submissions (2025-01-01 through 2026-09-30).`);
  const simulationParavets = await database.query(
    `select a.account_key, a.full_name, b.name as barangay
       from ekapon.accounts a
       left join ekapon.barangays b on b.id = a.barangay_id
      where a.account_type = 'Paravet' and a.middle_name = 'Simulation' and a.archived_at is null
      order by a.full_name`,
  );
  for (const account of simulationParavets.rows) {
    console.log(`Simulation Paravet: ${account.full_name} · ${account.barangay} · ${account.account_key} / MockVet!2026`);
  }
} finally {
  await database.close();
}
