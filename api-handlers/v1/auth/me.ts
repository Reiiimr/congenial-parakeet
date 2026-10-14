import { route, ok } from '../../../server/http';
import { requireAuth } from '../../../server/auth';
import { sql } from '../../../server/db';

export default route({
  GET: async (c) => {
    const s = await requireAuth(c.req);
    const [preferences] = await sql()`
      select theme, error_duration_minutes as "errorDurationMinutes",
             case when profile_photo is not null
               then 'data:' || profile_photo_mime || ';base64,' || encode(profile_photo, 'base64')
               else null end as "profilePhoto"
        from ekapon.account_preferences where account_id = ${s.id}`;
    return ok({
      account: {
        id: s.id, type: s.type, name: s.name, username: s.username,
        accountKey: s.key, barangayId: s.barangayId, barangay: s.barangay,
        locale: s.locale, grants: s.grants,
        theme: preferences?.theme ?? 'light',
        errorDurationMinutes: preferences?.errorDurationMinutes ?? 5,
        profilePhoto: preferences?.profilePhoto ?? null,
      },
    });
  },
});
