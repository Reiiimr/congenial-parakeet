import { z } from 'zod';
import { route, ok, parse } from '../../../server/http';
import { requireAuth } from '../../../server/auth';
import { sql, tx } from '../../../server/db';

const updateProfile = z.object({
  firstName: z.string().trim().min(1, 'Required').max(80).optional(),
  middleName: z.string().trim().max(80).nullable().optional(),
  lastName: z.string().trim().min(1, 'Required').max(80).optional(),
  suffix: z.string().trim().max(80).nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'Send at least one name field to change.' });
export default route({
  GET: async (c) => {
    const session = await requireAuth(c.req, { allowMaintenance: true });
    const [profile] = await sql()` 
      select first_name as "firstName", middle_name as "middleName",
             last_name as "lastName", suffix
        from ekapon.accounts
       where id = ${session.id}`;
    const [photo] = await sql()`select profile_photo_mime as "mimeType", encode(profile_photo, 'base64') as data from ekapon.account_preferences where account_id = ${session.id}`;
    return ok({ profile, photo: photo ?? null });
  },

  PATCH: async (c) => {
    const session = await requireAuth(c.req, { allowMaintenance: true });
    const profile = parse(updateProfile, c.body);
    const changes: Record<string, unknown> = {};
    if (profile.firstName !== undefined) changes.first_name = profile.firstName;
    if (profile.middleName !== undefined) changes.middle_name = profile.middleName || null;
    if (profile.lastName !== undefined) changes.last_name = profile.lastName;
    if (profile.suffix !== undefined) changes.suffix = profile.suffix || null;
    const result = await tx(session.id, async (q) => {
      const [before] = await q`
        select first_name as "firstName", middle_name as "middleName",
               last_name as "lastName", suffix
          from ekapon.accounts where id = ${session.id} for update`;
      await q`update ekapon.accounts set ${q(changes)} where id = ${session.id}`;
      const [saved] = await q`
        select first_name as "firstName", middle_name as "middleName",
               last_name as "lastName", suffix
          from ekapon.accounts where id = ${session.id}`;
      const [undo] = await q`
        insert into ekapon.edit_undo (actor_id, entity_type, entity_key, before_data, after_data)
        values (${session.id}, 'account_profile', ${String(session.id)},
                ${q.json(before)}, ${q.json(saved)})
        returning token`;
      return { profile: saved, undoToken: undo.token as string };
    });
    return ok(result);
  },
});
