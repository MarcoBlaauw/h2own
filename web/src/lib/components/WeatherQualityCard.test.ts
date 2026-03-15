import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import WeatherQualityCard from './WeatherQualityCard.svelte';

describe('WeatherQualityCard', () => {
  it('shows key labels for available weather data', () => {
    const { getByText, getByTestId } = render(WeatherQualityCard, {
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
    expect(getByText('Detailed weather metrics')).toBeTruthy();
    expect(getByText('Cloud base')).toBeTruthy();
    expect(getByText('Cloud ceiling')).toBeTruthy();
    expect(getByText('Visibility')).toBeTruthy();
    expect(getByText('Sunrise')).toBeTruthy();
    expect(getByText('Sunset')).toBeTruthy();
    expect(getByTestId('impact-uv')).toBeTruthy();
    expect(getByTestId('impact-rainfall')).toBeTruthy();
    expect(getByTestId('impact-wind')).toBeTruthy();
    expect(getByTestId('impact-temp-stress')).toBeTruthy();
  });

  it('shows key labels for empty state', () => {
    const { getByText } = render(WeatherQualityCard, {
      props: { dailyWeather: [] },
    });

    expect(getByText('No data')).toBeTruthy();
    expect(getByText('Connect a location to see forecasts.')).toBeTruthy();
    expect(getByText('Add a location with coordinates to view daily weather guidance.')).toBeTruthy();
  });

  it('shows key labels for unavailable state', () => {
    const { getByText } = render(WeatherQualityCard, {
      props: {
        dailyWeather: [],
        error: 'Location is missing coordinates',
      },
    });

    expect(getByText('Unavailable')).toBeTruthy();
    expect(getByText('Location is missing coordinates')).toBeTruthy();
  });

  it('assigns severity classes by threshold', () => {
    const { getByTestId } = render(WeatherQualityCard, {
      props: {
        dailyWeather: [
          {
            recordedAt: '2024-03-01T00:00:00.000Z',
            airTempF: 99,
            uvIndex: 9,
            rainfallIn: '1.10',
            windSpeedMph: 26,
          },
        ],
      },
    });

    expect(getByTestId('impact-uv').dataset.severity).toBe('danger');
    expect(getByTestId('impact-rainfall').dataset.severity).toBe('danger');
    expect(getByTestId('impact-wind').dataset.severity).toBe('danger');
    expect(getByTestId('impact-temp-stress').dataset.severity).toBe('danger');
  });

  it('provides accessible names for non-decorative icons', () => {
    const { getByLabelText } = render(WeatherQualityCard, {
      props: {
        dailyWeather: [
          {
            recordedAt: '2024-03-01T00:00:00.000Z',
            airTempF: 72,
            uvIndex: 4,
            rainfallIn: '0.10',
            windSpeedMph: 7,
            cloudBaseKm: '2.00',
            cloudCeilingKm: '4.20',
            visibilityMi: '8.50',
            sunriseTime: '2024-03-01T11:10:00.000Z',
            sunsetTime: '2024-03-01T23:00:00.000Z',
          },
        ],
      },
    });

    expect(getByLabelText('Weather quality')).toBeTruthy();
    expect(getByLabelText('UV')).toBeTruthy();
    expect(getByLabelText('Rain')).toBeTruthy();
    expect(getByLabelText('Wind')).toBeTruthy();
    expect(getByLabelText('Heat stress')).toBeTruthy();
  });
});
