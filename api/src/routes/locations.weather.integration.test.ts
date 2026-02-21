import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { locationsRoutes } from './locations.js';
import { weatherService, WeatherProviderRateLimitError } from '../services/weather.js';

describe('GET /locations/:locationId/weather', () => {
  let app: ReturnType<typeof Fastify>;
  const currentUserId = '2b5c4d1a-6e12-4d2a-b9f3-0a6f3a29e1f2';

  beforeEach(async () => {
    app = Fastify();
    app.decorate('auth', {
      verifySession: vi.fn(async (req: any) => {
        req.user = { id: currentUserId, role: 'member' };
      }),
      requireRole: () => async () => {},
    } as any);

    await app.register(locationsRoutes, { prefix: '/locations' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  it('returns weather data for a location', async () => {
    const locationId = '72d3210b-23f2-4e47-90b3-fab2a2d2a084';
    const recordedAt = new Date('2024-03-01T00:00:00.000Z');

    vi.spyOn(weatherService, 'getWeatherForLocation').mockResolvedValue({
      items: [
        {
          weatherId: '4c0c99e5-3211-4e38-8cc1-6d198f03f4f2',
          locationId,
          recordedAt,
          airTempF: 74,
          uvIndex: 6,
          rainfallIn: '0.10',
          windSpeedMph: 8,
          humidityPercent: 50,
          pressureInhg: '30.01',
          createdAt: new Date('2024-03-01T00:05:00.000Z'),
        },
      ],
    } as any);

    const response = await app.inject({
      method: 'GET',
      url: `/locations/${locationId}/weather?granularity=day`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      items: [
        {
          weatherId: '4c0c99e5-3211-4e38-8cc1-6d198f03f4f2',
          locationId,
          recordedAt: recordedAt.toISOString(),
          airTempF: 74,
          uvIndex: 6,
          rainfallIn: '0.10',
          windSpeedMph: 8,
          humidityPercent: 50,
          pressureInhg: '30.01',
          createdAt: new Date('2024-03-01T00:05:00.000Z').toISOString(),
        },
      ],
    });
    expect(weatherService.getWeatherForLocation).toHaveBeenCalledWith({
      locationId,
      userId: currentUserId,
      role: 'member',
      from: undefined,
      to: undefined,
      granularity: 'day',
      refresh: undefined,
    });
  });

  it('returns 404 when location is missing', async () => {
    const locationId = '72d3210b-23f2-4e47-90b3-fab2a2d2a084';

    vi.spyOn(weatherService, 'getWeatherForLocation').mockRejectedValue(
      new Error('Location not found')
    );

    const response = await app.inject({
      method: 'GET',
      url: `/locations/${locationId}/weather?granularity=day`,
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'Location not found' });
  });

  it('returns 429 when weather provider is rate limited', async () => {
    const locationId = '72d3210b-23f2-4e47-90b3-fab2a2d2a084';

    vi.spyOn(weatherService, 'getWeatherForLocation').mockRejectedValue(
      new WeatherProviderRateLimitError('Tomorrow.io request failed (429)', 180)
    );

    const response = await app.inject({
      method: 'GET',
      url: `/locations/${locationId}/weather?granularity=day`,
    });

    expect(response.statusCode).toBe(429);
    expect(response.json()).toEqual({
      error: 'Tomorrow.io request failed (429)',
      retryAfterSeconds: 180,
    });
  });
});
