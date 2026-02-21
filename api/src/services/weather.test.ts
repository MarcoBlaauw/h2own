import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  WeatherProviderRateLimitError,
  WeatherService,
  type WeatherProvider,
} from './weather.js';

describe('WeatherService', () => {
  let provider: WeatherProvider;
  let service: WeatherService;

  beforeEach(() => {
    provider = {
      fetchDailyWeather: vi.fn(),
    };
    service = new WeatherService({} as any, provider, 30 * 60 * 1000, 5 * 60 * 1000);
    vi.spyOn(service as any, 'ensureLocationAccess').mockResolvedValue({
      locationId: 'loc-1',
      userId: 'user-1',
      latitude: '33.75',
      longitude: '-84.39',
      isActive: true,
    });
  });

  it('uses cached weather without calling upstream when cache is fresh', async () => {
    const weather = { items: [{ weatherId: 'w-1' }] };
    vi.spyOn(service as any, 'listWeather').mockResolvedValue(weather);
    vi.spyOn(service as any, 'getLatestWeatherFetchAt').mockResolvedValue(new Date());

    const result = await service.getWeatherForLocation({
      locationId: 'loc-1',
      userId: 'user-1',
      granularity: 'day',
    });

    expect(result).toEqual(weather);
    expect(provider.fetchDailyWeather).not.toHaveBeenCalled();
  });

  it('refreshes from upstream when cache is stale', async () => {
    vi.spyOn(service as any, 'listWeather')
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({ items: [{ weatherId: 'w-2' }] });
    vi.spyOn(service as any, 'getLatestWeatherFetchAt').mockResolvedValue(
      new Date(Date.now() - 31 * 60 * 1000)
    );
    vi.spyOn(service as any, 'storeWeather').mockResolvedValue(undefined);
    (provider.fetchDailyWeather as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await service.getWeatherForLocation({
      locationId: 'loc-1',
      userId: 'user-1',
      granularity: 'day',
    });

    expect(provider.fetchDailyWeather).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ items: [{ weatherId: 'w-2' }] });
  });

  it('returns stale cached weather when upstream returns 429', async () => {
    const cachedWeather = { items: [{ weatherId: 'w-3' }] };
    vi.spyOn(service as any, 'listWeather').mockResolvedValue(cachedWeather);
    vi.spyOn(service as any, 'getLatestWeatherFetchAt').mockResolvedValue(
      new Date(Date.now() - 31 * 60 * 1000)
    );
    (provider.fetchDailyWeather as ReturnType<typeof vi.fn>).mockRejectedValue(
      new WeatherProviderRateLimitError('Tomorrow.io request failed (429)', 120)
    );

    const result = await service.getWeatherForLocation({
      locationId: 'loc-1',
      userId: 'user-1',
      granularity: 'day',
    });

    expect(result).toEqual(cachedWeather);
  });

  it('throws 429 rate-limit error when cache is empty', async () => {
    vi.spyOn(service as any, 'listWeather').mockResolvedValue({ items: [] });
    vi.spyOn(service as any, 'getLatestWeatherFetchAt').mockResolvedValue(null);
    (provider.fetchDailyWeather as ReturnType<typeof vi.fn>).mockRejectedValue(
      new WeatherProviderRateLimitError('Tomorrow.io request failed (429)', 60)
    );

    await expect(
      service.getWeatherForLocation({
        locationId: 'loc-1',
        userId: 'user-1',
        granularity: 'day',
      })
    ).rejects.toMatchObject({
      message: 'Tomorrow.io request failed (429)',
      statusCode: 429,
      retryAfterSeconds: 60,
    });
  });
});
