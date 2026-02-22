import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import WeatherQualityCard from './WeatherQualityCard.svelte';

describe('WeatherQualityCard', () => {
  it('shows a quality score for available weather data', () => {
    const { getByText } = render(WeatherQualityCard, {
      props: {
        dailyWeather: [
          {
            recordedAt: '2024-03-01T00:00:00.000Z',
            createdAt: '2024-03-01T00:05:00.000Z',
            sunriseTime: '2024-03-01T11:10:00.000Z',
            sunsetTime: '2024-03-01T23:00:00.000Z',
            visibilityMi: '9.90',
            cloudCoverPercent: '40.00',
            cloudBaseKm: '2.35',
            cloudCeilingKm: '4.80',
            airTempF: 78,
            temperatureApparentF: 81,
            uvIndex: 5,
            uvHealthConcern: 1,
            ezHeatStressIndex: 2,
            rainfallIn: '0.00',
            windDirectionDeg: 240,
            windGustMph: 17,
            windSpeedMph: 10,
            humidityPercent: 44,
          },
        ],
      },
    });

    expect(getByText('Pool weather quality')).toBeTruthy();
    expect(getByText(/Excellent|Good|Fair|Poor/)).toBeTruthy();
    expect(getByText('Today')).toBeTruthy();
    expect(getByText(/Last refreshed:/)).toBeTruthy();
    expect(getByText('Solar')).toBeTruthy();
    expect(getByText('Sky')).toBeTruthy();
    expect(getByText('UV And Heat')).toBeTruthy();
    expect(getByText('Wind And Air')).toBeTruthy();
  });

  it('shows the empty state when no data exists', () => {
    const { getByText } = render(WeatherQualityCard, {
      props: { dailyWeather: [] },
    });

    expect(getByText('No data')).toBeTruthy();
    expect(getByText('Add a location with coordinates to view daily weather guidance.')).toBeTruthy();
  });

  it('shows an unavailable state when weather loading fails', () => {
    const { getByText } = render(WeatherQualityCard, {
      props: {
        dailyWeather: [],
        error: 'Location is missing coordinates',
      },
    });

    expect(getByText('Unavailable')).toBeTruthy();
    expect(getByText('Location is missing coordinates')).toBeTruthy();
  });
});
