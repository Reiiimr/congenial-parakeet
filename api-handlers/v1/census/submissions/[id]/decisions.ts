import { z } from 'zod';
import { route, ok, parse } from '../../../../../server/http';
import { tx } from '../../../../../server/db';
import { requireAuth } from '../../../../../server/auth';
import { unprocessable } from '../../../../../server/errors';
import { accessSubmission, idParam } from '../../../../../server/census';

const body = z.object({
  decisions: z.array(z.object({
    ownerId: z.string().uuid(),
    decision: z.enum(['new', 'merge', 'replace', 'keep', 'reject']),
    matchedOwnerId: z.string().uuid().nullish(),
  })).min(1).max(200),
});

/** Admin / SuperAdmin choose, owner by owner, what approval will do. Nothing reaches the registry until the review is approved. */
export default route({
  PUT: async (c) => {
    const session = await requireAuth(c.req, { roles: ['SuperAdmin', 'Admin'] });
    const id = parse(idParam, c.query.id);
    const { decisions } = parse(body, c.body);
    await tx(session.id, async (q) => {
      const submission = await accessSubmission(q, id, session, true);
      for (const item of decisions) {
        const needsMatch = item.decision === 'merge' || item.decision === 'replace' || item.decision === 'keep';
        if (needsMatch && !item.matchedOwnerId) throw unprocessable('MATCH_REQUIRED', 'Choose which registry owner this decision refers to.');
        if (item.matchedOwnerId) {
          const [match] = await q`
            select id from ekapon.registry_owners
             where id = ${item.matchedOwnerId}::uuid and barangay_id = ${submission.barangay_id} and archived_at is null`;
          if (!match) throw unprocessable('MATCH_NOT_FOUND', 'That registry owner is not in this barangay or is archived.');
        }
        const updated = await q`
          update ekapon.census_owners
             set decision = ${item.decision}, matched_owner_id = ${needsMatch ? item.matchedOwnerId ?? null : null}
           where id = ${item.ownerId}::uuid and submission_id = ${id}::uuid
          returning id`;
        if (!updated.length) throw unprocessable('OWNER_NOT_FOUND', 'One of the owners is not part of this submission.');
      }
    });
    return ok({ saved: decisions.length });
  },
});
