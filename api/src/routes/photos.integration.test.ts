import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { photosRoutes } from './photos.js';
import { photosService } from '../services/photos.js';

describe('POST /photos/confirm', () => {
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

    await app.register(photosRoutes, { prefix: '/photos' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  it('confirms a photo upload', async () => {
    const poolId = '0b75c93b-7ae5-4a08-9a69-8191355f2175';
    const photo = {
      photoId: '9b93d8f1-0e7a-4f3d-b76a-5f7a9e1a0ed1',
      poolId,
      userId: currentUserId,
      url: 'https://cdn.example.com/pools/1/photo.jpg',
      thumbnailUrl: null,
      meta: null,
      tags: null,
      createdAt: new Date('2024-03-10T12:01:00.000Z'),
    };

    vi.spyOn(photosService, 'confirmUpload').mockResolvedValue(photo as any);

    const response = await app.inject({
      method: 'POST',
      url: '/photos/confirm',
      payload: {
        fileUrl: photo.url,
        poolId,
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      ...photo,
      createdAt: photo.createdAt.toISOString(),
    });
    expect(photosService.confirmUpload).toHaveBeenCalledWith(currentUserId, {
      fileUrl: photo.url,
      poolId,
    });
  });
});
