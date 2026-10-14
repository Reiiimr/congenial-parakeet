import { z } from 'zod';
import { route, ok, parse } from '../../../../server/http';
import { tx } from '../../../../server/db';
import { requireAuth } from '../../../../server/auth';
import { AppError, notFound } from '../../../../server/errors';

const idSchema = z.coerce.number().int().positive();

export default route({
  GET: async (c) => {
    const session = await requireAuth(c.req, { roles: ['SuperAdmin', 'Admin', 'Paravet'] });
    const id = parse(idSchema, c.query.id);
    const [metadata] = await tx(session.id, (q) =>
      q`select purged_at from ekapon.id_verifications where id = ${id}`);
    if (!metadata) throw notFound('ID verification not found.');
    if (metadata.purged_at) {
      throw new AppError(410, 'ID_PHOTO_EXPIRED', 'This ID photo was permanently deleted after its 30-day review-retention period.');
    }
    let row;
    try {
      [row] = await tx(session.id, (q) => q`select image, mime from ekapon.get_id_photo(${id})`);
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === '22023') {
        throw new AppError(410, 'ID_PHOTO_UNAVAILABLE', 'This ID photo is no longer available for review.');
      }
      throw error;
    }
    if (!row) throw notFound('ID photo not found.');
    return ok({ mime: row.mime, data: Buffer.from(row.image).toString('base64') });
  },
});
