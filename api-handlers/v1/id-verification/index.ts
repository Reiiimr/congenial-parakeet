import { z } from 'zod';
import { route, ok, created, parse } from '../../../server/http';
import { sql, tx } from '../../../server/db';
import { requireAuth } from '../../../server/auth';
import { listQuery } from '../../../server/listing';
import { unprocessable } from '../../../server/errors';

const query = listQuery.pick({ page: true, pageSize: true }).extend({
  status: z.enum(['pending', 'verified', 'rejected', 'all']).default('pending'),
});

const photo = z.object({
  mime: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  data: z.string().min(1).max(700_000).regex(/^[A-Za-z0-9+/]+={0,2}$/),
});

function hasValidSignature(mime: string, bytes: Buffer): boolean {
  if (mime === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
}

export default route({
  GET: async (c) => {
    const session = await requireAuth(c.req, { roles: ['SuperAdmin', 'Admin', 'Paravet', 'User'] });
    if (session.type === 'User') {
      const data = await sql()`
        select id, status, reviewer_name as "reviewerName", reviewed_at as "reviewedAt",
               decision_reason as "decisionReason", submitted_at as "submittedAt",
               purge_after as "purgeAfter", purged_at as "purgedAt"
          from ekapon.id_verifications
         where user_id = ${session.id}
         order by submitted_at desc, id desc
         limit 20`;
      return ok({ data });
    }

    const f = parse(query, c.query);
    const barangayScope = session.type === 'Paravet';
    const args: unknown[] = [f.status, barangayScope, session.barangayId, f.pageSize, (f.page - 1) * f.pageSize];
    const where = [
      "($1 = 'all' or v.status = $1)",
      '($2 = false or v.barangay_id = $3)',
    ];
    const base = `from ekapon.id_verifications v
      join ekapon.accounts a on a.id = v.user_id
      join ekapon.barangays b on b.id = v.barangay_id
      where ${where.join(' and ')}`;
    const [{ total }] = await sql().unsafe(`select count(*)::int as total ${base}`, args.slice(0, 3) as never[]) as unknown as [{ total: number }];
    const data = await sql().unsafe(`
      select v.id, v.user_id as "userId", a.full_name as "userName", b.name as barangay,
             v.mime, v.status, v.reviewer_name as "reviewerName",
             v.reviewed_at as "reviewedAt", v.decision_reason as "decisionReason",
             v.submitted_at as "submittedAt", v.purge_after as "purgeAfter",
             v.purged_at as "purgedAt", (v.purged_at is null) as "photoAvailable"
        ${base}
       order by case when v.status = 'pending' then 0 else 1 end, v.submitted_at desc, v.id desc
       limit $4 offset $5`, args as never[]) as unknown as Record<string, unknown>[];
    return ok({ data, page: f.page, pageSize: f.pageSize, total });
  },

  POST: async (c) => {
    const session = await requireAuth(c.req, { roles: ['User'] });
    const input = parse(photo, c.body);
    const bytes = Buffer.from(input.data, 'base64');
    if (bytes.length > 500_000 || bytes.toString('base64') !== input.data || !hasValidSignature(input.mime, bytes)) {
      throw unprocessable('INVALID_ID_PHOTO', 'Use a valid JPEG, PNG or WebP image no larger than 500 KB.');
    }
    const [{ id }] = await tx(session.id, (q) =>
      q`select ekapon.submit_id_photo(decode(${input.data}, 'base64'), ${input.mime}) as id`);
    return created({ id });
  },
}, { maxBody: 800_000 });
