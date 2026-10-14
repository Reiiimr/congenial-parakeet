import { z } from 'zod';
import { route, ok, parse } from '../../../server/http';
import { tx } from '../../../server/db';
import { requireAuth } from '../../../server/auth';

const body = z.object({
  locale: z.enum(['en', 'fil']).optional(),
  theme: z.enum(['light', 'dark']).optional(),
  errorDurationMinutes: z.coerce.number().int().min(1).max(60).optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'Choose a preference to update.' });

/** Saves the signed-in person's language, appearance and API notice duration. */
export default route({
  PUT: async (c) => {
    const session = await requireAuth(c.req, { allowMaintenance: true });
    const preference = parse(body, c.body);
    await tx(session.id, async (q) => {
      if (preference.locale) await q`update ekapon.accounts set locale = ${preference.locale} where id = ${session.id}`;
      if (preference.theme !== undefined || preference.errorDurationMinutes !== undefined) {
        await q`
          insert into ekapon.account_preferences (account_id, theme, error_duration_minutes)
          values (${session.id}, ${preference.theme ?? 'light'}, ${preference.errorDurationMinutes ?? 5})
          on conflict (account_id) do update set
            theme = coalesce(${preference.theme ?? null}, ekapon.account_preferences.theme),
            error_duration_minutes = coalesce(${preference.errorDurationMinutes ?? null}, ekapon.account_preferences.error_duration_minutes),
            updated_at = now()`;
      }
    });
    return ok(preference);
  },
});
