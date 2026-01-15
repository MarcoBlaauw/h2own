import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { poolsRoutes } from './pools.js';
import { photosService } from '../services/photos.js';

describe('POST /pools/:poolId/photos', () => {
  let app: ReturnType<typeof Fastify>;
  const currentUserId = '2b5c4d1a-6e12-4d2a-b9f3-0a6f3a29e1f2';

  beforeEach(async () => {
    app = Fastify();
    app.decorate('auth', {
      verifySession: vi.fn(async (req: any) => {
        req.user = { id: currentUserId };
      }),
      requireRole: () => async () => {},
    } as any);

    await app.register(poolsRoutes, { prefix: '/pools' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  it('returns a presigned upload payload', async () => {
    const poolId = '0b75c93b-7ae5-4a08-9a69-8191355f2175';
    vi.spyOn(photosService, 'createPresignedUpload').mockResolvedValue({
      uploadUrl: 'https://uploads.example.com/pools/1/photo.jpg',
      fileUrl: 'https://cdn.example.com/pools/1/photo.jpg',
      fields: null,
    });

    const response = await app.inject({
      method: 'POST',
      url: `/pools/${poolId}/photos`,
      payload: { filename: 'photo.jpg', contentType: 'image/jpeg' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      uploadUrl: 'https://uploads.example.com/pools/1/photo.jpg',
      fileUrl: 'https://cdn.example.com/pools/1/photo.jpg',
      fields: null,
    });
    expect(photosService.createPresignedUpload).toHaveBeenCalledWith(poolId, currentUserId, {
      filename: 'photo.jpg',
      contentType: 'image/jpeg',
    });
  });
});
