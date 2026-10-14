import { route, ok } from '../../../server/http';
import { sql } from '../../../server/db';
import { requireAuth } from '../../../server/auth';

const DATASETS = ['owners', 'pets', 'paravets', 'respondents', 'households', 'animals', 'stubs', 'services', 'programs', 'participants'] as const;

export default route({
  GET: async (c) => {
    const session = await requireAuth(c.req, { roles: ['SuperAdmin', 'Admin', 'Paravet', 'User'] });
    const citywide = session.type === 'SuperAdmin' || session.type === 'Admin';
    const barangay = session.barangay ?? '';
    const visibleDatasets = session.type === 'Paravet'
      ? ['owners', 'pets', 'respondents', 'households', 'animals']
      : session.type === 'User' ? [] : DATASETS;
    const [recordRows, accountRows, prelistingRows, censusRows, censusMineRows, censusImportRows, barangayRows] = await Promise.all([
      sql().unsafe(
        `select dataset, count(*)::int as count
           from ekapon.dashboard_records
          where archived = false and dataset = any($1::text[])
            and ($2 or lower(record_data->>'barangay') = lower($3))
          group by dataset`,
        [visibleDatasets, citywide, barangay],
      ),
      (citywide || session.type === 'Paravet') ? sql().unsafe(
        `select account_type::text as dataset, count(*)::int as count
           from ekapon.accounts where archived_at is null
             and ($1 or barangay_id = $2)
          group by account_type`,
        [citywide, session.barangayId],
      ) : Promise.resolve([]),
      citywide ? sql()`select count(*)::int as count from ekapon.prelistings` : sql()`select 0::int as count`,
      session.type === 'User' ? sql()`select 'none'::text as status, 0::int as count where false` : sql().unsafe(
        `select status, count(*)::int as count from ekapon.census_submissions
          where ($1 or barangay_id = $2) group by status`,
        [citywide, session.barangayId],
      ),
      session.type === 'User' ? sql()`select 0::int as count` : sql().unsafe(
        `select count(*)::int as count from ekapon.census_submissions
          where submitted_by = $1 and ($2 or barangay_id = $3)`,
        [session.id, citywide, session.barangayId],
      ),
      session.type === 'User' ? sql()`select 0::int as count` : sql().unsafe(
        `select count(*)::int as count from ekapon.census_submissions
          where source = 'csv' and ($1 or barangay_id = $2)`,
        [citywide, session.barangayId],
      ),
      session.type === 'User' ? sql()`select 0::int as count` : sql().unsafe(
        `select count(*)::int as count from ekapon.barangays where ($1 or id = $2)`,
        [citywide, session.barangayId],
      ),
    ]);
    const counts: Record<string, number> = Object.fromEntries(DATASETS.map((dataset) => [dataset, 0]));
    for (const row of recordRows as unknown as { dataset: string; count: number }[]) counts[row.dataset] = row.count;
    const accounts = accountRows as unknown as { dataset: string; count: number }[];
    counts.accounts = accounts
      .filter((row) => session.type !== 'Admin' || !['Admin', 'SuperAdmin'].includes(row.dataset))
      .reduce((sum, row) => sum + row.count, 0);
    counts.prelistings = Number((prelistingRows[0] as { count: number }).count);
    const census = censusRows as unknown as { status: string; count: number }[];
    counts['census-pending'] = census.find((row) => row.status === 'pending')?.count ?? 0;
    counts['census-approved'] = census.find((row) => row.status === 'approved')?.count ?? 0;
    counts['census-rejected'] = census.find((row) => row.status === 'rejected')?.count ?? 0;
    counts['census-submit'] = Number((censusMineRows[0] as { count: number }).count);
    counts['census-import'] = Number((censusImportRows[0] as { count: number }).count);
    counts['census-mine'] = counts['census-submit'];
    counts['census-review'] = counts['census-pending'];
    const accessibleBarangays = Number((barangayRows[0] as { count: number }).count);
    counts['census-summary'] = accessibleBarangays;
    counts['census-front'] = accessibleBarangays;
    counts['program-day'] = counts.programs;
    counts['prelisting-submit'] = counts.prelistings;
    const [verifications] = session.type === 'SuperAdmin' || session.type === 'Admin'
      ? await sql()`select count(*)::int as count from ekapon.id_verifications`
      : [null];
    counts['id-verification'] = verifications?.count ?? 0;
    return ok({ counts });
  },
});
