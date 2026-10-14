import { z } from 'zod';
import { route, ok, parse } from '../../../../server/http';
import { tx } from '../../../../server/db';
import { requireAuth } from '../../../../server/auth';

const idSchema = z.coerce.number().int().positive();
const body = z.object({
  outcome: z.enum(['verified', 'rejected']),
  reason: z.string().trim().max(300).default(''),
}).refine((value) => value.outcome !== 'rejected' || value.reason.length >= 3, {
  message: 'A rejection reason of at least 3 characters is required.',
  path: ['reason'],
});

export default route({
  POST: async (c) => {
    const session = await requireAuth(c.req, { roles: ['SuperAdmin', 'Admin', 'Paravet'] });
    const id = parse(idSchema, c.query.id);
    const input = parse(body, c.body);
    await tx(session.id, (q) =>
      q`select ekapon.decide_id_verification(${id}, ${input.outcome}, ${input.reason || null})`);
    return ok({ id, status: input.outcome });
  },
});
