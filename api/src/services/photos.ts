import { randomUUID } from 'crypto';
import { extname } from 'path';
import { db as dbClient } from '../db/index.js';
import * as schema from '../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { PoolCoreService } from './pools/core.js';
import { env } from '../env.js';

export interface PresignPhotoData {
  filename?: string;
  contentType?: string;
}

export interface ConfirmPhotoData {
  fileUrl: string;
  poolId: string;
  testId?: string;
  meta?: Record<string, unknown>;
}

const joinUrl = (base: string, path: string) => {
  if (!base) return path;
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  return `${normalizedBase}/${normalizedPath}`;
};

export class PhotosService {
  constructor(
    private readonly db = dbClient,
    private readonly core: PoolCoreService = new PoolCoreService(db)
  ) {}

  async createPresignedUpload(poolId: string, userId: string, data: PresignPhotoData) {
    await this.core.ensurePoolAccess(poolId, userId);

    const uploadId = randomUUID();
    const extension = data.filename ? extname(data.filename).toLowerCase() : '';
    const key = `pools/${poolId}/${uploadId}${extension}`;

    const publicBase = env.PHOTO_PUBLIC_BASE_URL ?? '/uploads';
    const uploadBase = env.PHOTO_UPLOAD_BASE_URL ?? publicBase;
    const fileUrl = joinUrl(publicBase, key);
    const uploadUrl = joinUrl(uploadBase, key);

    return {
      uploadUrl,
      fileUrl,
      fields: null,
    };
  }

  async confirmUpload(userId: string, data: ConfirmPhotoData) {
    await this.core.ensurePoolAccess(data.poolId, userId);

    if (data.testId) {
      const [test] = await this.db
        .select({ poolId: schema.testSessions.poolId })
        .from(schema.testSessions)
        .where(eq(schema.testSessions.sessionId, data.testId));

      if (!test || test.poolId !== data.poolId) {
        throw new Error('Test does not belong to this pool');
      }
    }

    const [photo] = await this.db
      .insert(schema.photos)
      .values({
        poolId: data.poolId,
        userId,
        url: data.fileUrl,
        meta: data.meta,
      })
      .returning();

    if (data.testId) {
      await this.db
        .update(schema.testSessions)
        .set({ photoId: photo.photoId })
        .where(eq(schema.testSessions.sessionId, data.testId));
    }

    return photo;
  }
}

export const photosService = new PhotosService();
