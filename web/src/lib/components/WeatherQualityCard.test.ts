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
            airTempF: 78,
            uvIndex: 5,
            rainfallIn: '0.00',
          },
        ],
      },
    });

    expect(getByText('Pool weather quality')).toBeTruthy();
    expect(getByText(/Excellent|Good|Fair|Poor/)).toBeTruthy();
    expect(getByText('Today')).toBeTruthy();
  });

  it('shows the empty state when no data exists', () => {
    const { getByText } = render(WeatherQualityCard, {
      props: { dailyWeather: [] },
    });

    expect(getByText('No data')).toBeTruthy();
    expect(getByText('Add a location with coordinates to view daily weather guidance.')).toBeTruthy();
  });
});
