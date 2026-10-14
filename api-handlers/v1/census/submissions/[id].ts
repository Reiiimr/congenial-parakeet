import { z } from 'zod';
import { route, ok, parse } from '../../../../server/http';
import { sql, tx } from '../../../../server/db';
import { requireAuth } from '../../../../server/auth';
import { can } from '../../../../shared/permissions';
import { conflict, forbidden } from '../../../../server/errors';
import { accessSubmission, fetchSubmission, idParam, petOut, submissionOut, updateBody, writeContent } from '../../../../server/census';

const deleteQuery = z.object({ permanent: z.enum(['true', 'false']).default('false') });

export default route({
  GET: async (c) => {
    const session = await requireAuth(c.req, { roles: ['SuperAdmin', 'Admin', 'Paravet'] });
    const id = parse(idParam, c.query.id);
    await accessSubmission(sql(), id, session);
    const submission = await fetchSubmission(sql(), id);
    const owners = await sql()`
      select id, line_no, owner_name, address, contact, decision, matched_owner_id
        from ekapon.census_owners where submission_id = ${id}::uuid order by line_no`;
    const pets = await sql()`
      select p.* from ekapon.census_pets p join ekapon.census_owners o on o.id = p.owner_id
       where o.submission_id = ${id}::uuid order by p.owner_id, p.line_no`;
    const candidates = session.type === 'Paravet' ? [] : await sql()`select * from ekapon.census_owner_candidates(${id}::uuid)`;
    const attachments = await sql()`
      select id, mime, octet_length(image)::int as bytes, created_at
        from ekapon.census_attachments where submission_id = ${id}::uuid order by id`;
    return ok({
      submission: submissionOut(submission),
      owners: owners.map((owner) => ({
        id: owner.id, lineNo: owner.line_no, ownerName: owner.owner_name, address: owner.address, contact: owner.contact,
        decision: owner.decision, matchedOwnerId: owner.matched_owner_id,
        pets: pets.filter((pet) => pet.owner_id === owner.id).map(petOut),
        candidates: candidates.filter((candidate) => candidate.census_owner_id === owner.id).map((candidate) => ({
          registryOwnerId: candidate.registry_owner_id, ownerName: candidate.owner_name, address: candidate.address, petCount: candidate.pet_count,
        })),
      })),
      attachments: attachments.map((a) => ({ id: a.id, mime: a.mime, bytes: a.bytes, createdAt: a.created_at })),
    });
  },

  /** Paravets fix their own pending submission; staff can encode owners from the photos of an image submission. */
  PATCH: async (c) => {
    const session = await requireAuth(c.req, { roles: ['SuperAdmin', 'Admin', 'Paravet'] });
    const id = parse(idParam, c.query.id);
    const body = parse(updateBody, c.body);
    await tx(session.id, async (q) => {
      await accessSubmission(q, id, session, true);
      await q`
        update ekapon.census_submissions
           set label = coalesce(${body.label ?? null}, label),
               census_date = coalesce(${body.censusDate ?? null}::date, census_date),
               households_visited = coalesce(${body.householdsVisited ?? null}::int, households_visited)
         where id = ${id}::uuid`;
      if (body.owners) await writeContent(q, id, body.owners);
    });
    return ok({ submission: submissionOut(await fetchSubmission(sql(), id)) });
  },

  /** Paravet: withdraw your own pending submission. With the delete permission: `?permanent=true` removes any unapproved one. */
  DELETE: async (c) => {
    const session = await requireAuth(c.req, { roles: ['SuperAdmin', 'Admin', 'Paravet'] });
    const id = parse(idParam, c.query.id);
    const { permanent } = parse(deleteQuery, c.query);
    if (permanent === 'true') {
      if (!can({ role: session.type, grants: session.grants }, 'census.delete')) {
        throw forbidden('Deleting a census submission needs special access from SuperAdmin.');
      }
      await tx(session.id, async (q) => {
        const row = await accessSubmission(q, id, session);
        if (row.status === 'approved') throw conflict('SUBMISSION_APPROVED', 'An approved submission cannot be deleted.');
        await q`delete from ekapon.census_submissions where id = ${id}::uuid`;
      });
      return ok({ deleted: true });
    }
    if (session.type !== 'Paravet') throw forbidden('Only the Paravet who submitted this census can withdraw it.');
    await tx(session.id, async (q) => {
      await accessSubmission(q, id, session, true);
      await q`update ekapon.census_submissions set status = 'withdrawn' where id = ${id}::uuid`;
    });
    return ok({ withdrawn: true });
  },
}, { maxBody: 600_000 });
