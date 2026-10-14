import { route, ok } from '../../../server/http';
import { sql } from '../../../server/db';
import { requireAuth } from '../../../server/auth';

export default route({
  GET: async (c) => {
    const session = await requireAuth(c.req, { roles: ['SuperAdmin', 'Admin', 'Paravet'] });
    const rows = await sql()`
      select record_data from ekapon.dashboard_records
       where dataset = 'programs' and not archived
         and (${session.type !== 'Paravet'} or lower(record_data->>'barangay') = lower(${session.barangay ?? ''}))
       order by record_data->>'date' asc limit 500`;
    return ok({ data: rows.map((row) => row.record_data) });
  },
});
