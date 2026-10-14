import { z } from 'zod';
import { route, ok, parse } from '../../server/http';
import { requireAuth } from '../../server/auth';
import { sql } from '../../server/db';
import { ACCOUNT_BASE } from '../../server/accountsView';

const query = z.object({ q: z.string().trim().min(2).max(120) });
const RECORD_PATHS: Record<string, string> = {
  owners: '/registry/owners',
  pets: '/registry/pets',
  paravets: '/paravets',
  programs: '/programs',
  stubs: '/stubs',
  services: '/services',
  respondents: '/registry/respondents',
  households: '/registry/households',
  animals: '/registry/animals',
  participants: '/registry/participants',
};

export default route({
  GET: async (c) => {
    const session = await requireAuth(c.req, { roles: ['SuperAdmin', 'Admin', 'Paravet'] });
    const { q } = parse(query, c.query);
    const pattern = `%${q}%`;
    const datasets = session.type === 'Paravet'
      ? ['owners', 'pets']
      : ['owners', 'pets', 'paravets', 'respondents', 'households', 'animals', 'stubs', 'services', 'programs', 'participants'];

    const recordRows = await sql()`
      select dataset, record_id, record_data, updated_at
        from ekapon.dashboard_records
       where dataset = any(${datasets}::text[])
         and archived = false
         and record_data::text ilike ${pattern}
         and (${session.type !== 'Paravet'} or lower(record_data->>'barangay') = lower(${session.barangay ?? ''}))
       order by updated_at desc
       limit 20`;
    const records = recordRows.map((row) => {
      const data = row.record_data as Record<string, unknown>;
      return {
        kind: 'record',
        dataset: row.dataset as string,
        id: String(row.record_id),
        label: String(data.name ?? data.petName ?? data.title ?? data.owner_name ?? data.pet_name ?? row.record_id),
        detail: [data.barangay, data.species, data.status].filter((part) => part != null && String(part)).map(String).join(' · '),
        to: `${RECORD_PATHS[row.dataset as string] ?? '/import-export'}?q=${encodeURIComponent(String(row.record_id))}&recordId=${encodeURIComponent(String(row.record_id))}`,
      };
    });

    const submissions = await sql()`
      select s.id, s.label, s.status, s.submitter_name, s.census_date, b.name as barangay
        from ekapon.census_submissions s
        join ekapon.barangays b on b.id = s.barangay_id
       where (${session.type !== 'Paravet'} or s.submitted_by = ${session.id})
         and (s.label ilike ${pattern} or s.submitter_name ilike ${pattern} or b.name ilike ${pattern} or s.id::text ilike ${pattern})
       order by s.created_at desc
       limit 10`;
    const submissionResults = submissions.map((row) => ({
      kind: 'submission',
      id: String(row.id),
      label: String(row.label),
      detail: `${row.submitter_name} · ${row.barangay} · ${row.status}`,
      to: `${session.type === 'Paravet' ? '/census/mine' : `/census/review/${row.status}`}/${row.id}`,
    }));

    let accounts: Array<{ kind: string; dataset: string; id: string; label: string; detail: string; to: string }> = [];
    if (session.type === 'SuperAdmin') {
      const rows = await sql().unsafe(
        `select id, account_key, full_name, account_type::text as account_type, mobile, barangay, status
           from (${ACCOUNT_BASE}) x
          where x.archived = false
            and (x.full_name ilike $1 or coalesce(x.account_key, '') ilike $1 or coalesce(x.username, '') ilike $1 or coalesce(x.mobile, '') ilike $1)
          order by x.full_name
          limit 10`,
        [pattern],
      );
      accounts = rows.map((row) => ({
        kind: 'account',
        dataset: 'accounts',
        id: String(row.id),
        label: String(row.full_name),
        detail: [row.account_type, row.account_key, row.barangay, row.status].filter(Boolean).map(String).join(' · '),
        to: `/accounts?accountId=${encodeURIComponent(String(row.id))}`,
      }));
    }

    if (!records.length && !submissionResults.length && !accounts.length) {
      return ok({ data: [], total: 0 });
    }
    return ok({ data: [...accounts, ...records, ...submissionResults].slice(0, 30), total: accounts.length + records.length + submissionResults.length });
  },
});
