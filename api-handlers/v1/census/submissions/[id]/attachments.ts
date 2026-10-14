import { z } from 'zod';
import { route, created, parse } from '../../../../../server/http';
import { tx } from '../../../../../server/db';
import { requireAuth } from '../../../../../server/auth';
import { unprocessable } from '../../../../../server/errors';
import { accessSubmission, idParam } from '../../../../../server/census';

const MAX_BYTES = 500_000;
const MAX_PHOTOS = 6;
const body = z.object({ mime: z.enum(['image/jpeg', 'image/png', 'image/webp']), data: z.string().min(1) });

/** Attach a photo of the paper census sheet (the browser shrinks it first). Pending submissions only. */
export default route({
  POST: async (c) => {
    const session = await requireAuth(c.req, { roles: ['Paravet'] });
    const id = parse(idParam, c.query.id);
    const { mime, data } = parse(body, c.body);
    const image = Buffer.from(data, 'base64');
    if (!image.length || image.length > MAX_BYTES) throw unprocessable('IMAGE_TOO_LARGE', 'Each photo must be under 500 KB. Use a smaller photo.');
    const attachmentId = await tx(session.id, async (q) => {
      await accessSubmission(q, id, session, true);
      const [{ n }] = await q`select count(*)::int as n from ekapon.census_attachments where submission_id = ${id}::uuid`;
      if (n >= MAX_PHOTOS) throw unprocessable('TOO_MANY_PHOTOS', `A submission can have at most ${MAX_PHOTOS} photos.`);
      const [row] = await q`
        insert into ekapon.census_attachments (submission_id, mime, image, uploaded_by)
        values (${id}::uuid, ${mime}, ${image}, ${session.id}) returning id`;
      return row.id as number;
    });
    return created({ id: attachmentId });
  },
}, { maxBody: 1_000_000 });
