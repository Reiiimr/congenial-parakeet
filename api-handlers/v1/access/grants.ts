import { z } from 'zod';
import { route, ok, created, parse } from '../../../server/http';
import { sql, tx } from '../../../server/db';
import { requireAuth } from '../../../server/auth';
import { listQuery } from '../../../server/listing';
import { GRANT_PERMISSIONS } from '../../../shared/permissions';

const query = listQuery.pick({ page: true, pageSize: true });
const body = z.object({
  granteeId: z.coerce.number().int().positive(),
  permission: z.enum(GRANT_PERMISSIONS),
  barangayId: z.coerce.number().int().positive().nullable().optional(),
  reason: z.string().trim().min(3).max(300),
  days: z.coerce.number().int().min(1).max(30),
});

export default route({
  GET: async (c) => {
    await requireAuth(c.req, { roles: ['SuperAdmin'] });
    const f = parse(query, c.query);
    const [{ total }] = await sql()`select count(*)::int as total from ekapon.access_grants`;
    const data = await sql()`
      select g.id, g.grantee_id as "granteeId", a.full_name as "granteeName",
             a.account_type::text as "granteeType", g.permission, g.barangay_id as "barangayId",
             b.name as barangay, g.reason, g.granted_by_name as "grantedByName",
             g.granted_at as "grantedAt", g.expires_at as "expiresAt",
             g.revoked_at as "revokedAt", g.revoked_by_name as "revokedByName",
             g.revoke_reason as "revokeReason"
        from ekapon.access_grants g
        join ekapon.accounts a on a.id = g.grantee_id
        left join ekapon.barangays b on b.id = g.barangay_id
       order by g.granted_at desc, g.id desc
       limit ${f.pageSize} offset ${(f.page - 1) * f.pageSize}`;
    const targets = await sql()`
      select id, full_name as name, account_type::text as type, barangay_id as "barangayId"
        from ekapon.accounts
       where account_type in ('Admin', 'Paravet') and status = 'Active' and archived_at is null
       order by lower(full_name), id`;
    const barangays = await sql()`select id, name from ekapon.barangays order by name`;
    return ok({ data, targets, barangays, page: f.page, pageSize: f.pageSize, total });
  },

  POST: async (c) => {
    const session = await requireAuth(c.req, { roles: ['SuperAdmin'] });
    const input = parse(body, c.body);
    const [{ id }] = await tx(session.id, (q) => q`
      select ekapon.grant_access(${input.granteeId}, ${input.permission},
        ${input.barangayId ?? null}, ${input.reason}, ${input.days}) as id`);
    return created({ id });
  },
});
