import type { Tx } from './db';
import { jsonValue } from './dashboard';
import { notFound } from './errors';

export interface CensusReviewer {
  id: number;
  name: string;
}

export async function recordCensusDecision(
  q: Tx,
  reviewer: CensusReviewer,
  submissionId: string,
  decision: 'approve' | 'reject',
  note: string,
): Promise<Record<string, unknown>> {
  const [submission] = await q`
    select status from ekapon.census_submissions where id = ${submissionId}::uuid for update
  ` as unknown as [{ status: string }?];
  if (!submission) throw notFound('Census submission not found.');

  const matched = decision === 'approve' ? await q`
    select distinct matched_owner_id as id
      from ekapon.census_owners
     where submission_id = ${submissionId}::uuid
       and decision in ('merge', 'replace')
       and matched_owner_id is not null
     order by matched_owner_id
  ` as unknown as Array<{ id: string }> : [];
  const matchedIds = matched.map((row) => row.id);
  const beforeOwners = matchedIds.length ? await q`
    select to_jsonb(owner_row) as data
      from ekapon.registry_owners owner_row
     where id = any(${q.array(matchedIds, 2950)})
     order by id
  ` as unknown as Array<{ data: Record<string, unknown> }> : [];
  const beforePets = matchedIds.length ? await q`
    select to_jsonb(pet_row) as data
      from ekapon.registry_pets pet_row
     where owner_id = any(${q.array(matchedIds, 2950)})
     order by id
  ` as unknown as Array<{ data: Record<string, unknown> }> : [];

  const [{ result }] = await q`
    select ekapon.decide_census_submission(${submissionId}::uuid, ${decision}, ${note || null}) as result
  ` as unknown as [{ result: Record<string, unknown> }];

  if (decision === 'approve') {
    const afterOwnerRows = await q`
      select to_jsonb(owner_row) as data
        from ekapon.registry_owners owner_row
       where id = any(${q.array(matchedIds, 2950)})
          or source_submission_id = ${submissionId}::uuid
       order by id
    ` as unknown as Array<{ data: Record<string, unknown> }>;
    const afterOwners = afterOwnerRows.map((row) => row.data);
    const ownerScope = afterOwners.map((row) => String(row.id));
    const afterPetRows = ownerScope.length ? await q`
      select to_jsonb(pet_row) as data
        from ekapon.registry_pets pet_row
       where owner_id = any(${q.array(ownerScope, 2950)})
       order by id
    ` as unknown as Array<{ data: Record<string, unknown> }> : [];
    await q`
      insert into ekapon.census_review_snapshots
        (submission_id, actor_id, owner_scope, before_owners, before_pets, after_owners, after_pets, review_note, undone_at)
      values (${submissionId}::uuid, ${reviewer.id}, ${q.array(ownerScope, 2950)},
              ${q.json(jsonValue(beforeOwners.map((row) => row.data)))},
              ${q.json(jsonValue(beforePets.map((row) => row.data)))},
              ${q.json(jsonValue(afterOwners))},
              ${q.json(jsonValue(afterPetRows.map((row) => row.data)))},
              ${note || null}, null)
      on conflict (submission_id) do update set
        actor_id = excluded.actor_id,
        owner_scope = excluded.owner_scope,
        before_owners = excluded.before_owners,
        before_pets = excluded.before_pets,
        after_owners = excluded.after_owners,
        after_pets = excluded.after_pets,
        review_note = excluded.review_note,
        captured_at = now(),
        undone_at = null
    `;
  }
  await q`
    insert into ekapon.census_submission_status_history
      (submission_id, actor_id, actor_name, from_status, to_status, action, note)
    values (${submissionId}::uuid, ${reviewer.id}, ${reviewer.name}, ${submission.status},
            ${decision === 'approve' ? 'approved' : 'rejected'}, 'review', ${note || null})
  `;
  return result;
}
