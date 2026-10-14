import { route, ok } from '../../server/http';
import { requireAuth } from '../../server/auth';
import { sql } from '../../server/db';

const routes: Record<string, string> = {
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
  accounts: '/accounts',
};

export default route({
  GET: async (c) => {
    const session = await requireAuth(c.req, { roles: ['SuperAdmin', 'Admin', 'Paravet'] });
    const rows = await sql()`
      with recent as (
        select dataset, record_id as id, record_data as record, updated_at as "updatedAt"
          from ekapon.dashboard_records
         where archived = false
           and (${session.type !== 'Paravet'} or (
             dataset in ('owners', 'pets') and lower(record_data->>'barangay') = lower(${session.barangay ?? ''})
           ))
        union all
        select 'accounts' as dataset, id::text as id,
               jsonb_build_object('name', full_name) as record, updated_at as "updatedAt"
          from ekapon.accounts
         where archived_at is null
           and account_type in ('Paravet', 'User')
           and ${session.type !== 'Paravet'}
      )
      select dataset, id, record, "updatedAt"
        from recent
       order by "updatedAt" desc, dataset, id
       limit 10`;
    return ok({ data: rows.filter((row) => routes[row.dataset]).map((row) => ({
      id: row.id,
      dataset: row.dataset,
      label: String(row.record.name ?? row.record.petName ?? row.record.title ?? row.record.owner_name ?? row.record.pet_name ?? `${row.dataset} ${row.id}`),
      updatedAt: row.updatedAt,
      to: `${routes[row.dataset]}?recordId=${encodeURIComponent(String(row.id))}`,
    })) });
  },
});
