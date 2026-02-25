import { describe, expect, it, vi } from 'vitest';
import {
  buildStationAdjustmentNote,
  buildTemperatureGuidanceNote,
  buildWeatherAdjustmentNote,
  chooseTemperatureForGuidance,
} from './recommender.js';

describe('buildWeatherAdjustmentNote', () => {
  it('returns null when no signals are present', () => {
    expect(buildWeatherAdjustmentNote(null)).toBeNull();
    expect(buildWeatherAdjustmentNote({})).toBeNull();
  });

  it('adds notes for high UV and rainfall', () => {
    const note = buildWeatherAdjustmentNote({ uvIndex: 8, rainfallIn: '0.5' });
    expect(note).toContain('High UV increases chlorine demand.');
    expect(note).toContain('Recent rain may dilute sanitizer levels.');
  });

  it('adds temperature notes for hot and cool conditions', () => {
    const hot = buildWeatherAdjustmentNote({ airTempF: 95 });
    expect(hot).toContain('Heat can accelerate chemical consumption.');

    const cool = buildWeatherAdjustmentNote({ airTempF: 55 });
    expect(cool).toContain('Cool temperatures can slow chemical activity.');
  });
});

describe('buildTemperatureGuidanceNote', () => {
  it('returns null when temperature or bounds are unavailable', () => {
    expect(buildTemperatureGuidanceNote(null, null, null)).toBeNull();
    expect(
      buildTemperatureGuidanceNote(82, { equipmentType: 'heater', status: 'enabled' }, {})
    ).toBeNull();
  });

  it('flags below-range temperatures with heater-aware messaging', () => {
    const noteWithHeater = buildTemperatureGuidanceNote(
      72,
      { equipmentType: 'heater', status: 'enabled' },
      { minTempF: '80.00' }
    );
    expect(noteWithHeater).toContain('below target 80F');
    expect(noteWithHeater).toContain('Heater support is configured');

    const noteWithoutHeater = buildTemperatureGuidanceNote(
      72,
      { equipmentType: 'none', status: 'disabled' },
      { minTempF: '80.00' }
    );
    expect(noteWithoutHeater).toContain('no active heater is configured');
  });

  it('flags above-range temperatures with chiller-aware messaging', () => {
    const noteWithCooling = buildTemperatureGuidanceNote(
      94,
      { equipmentType: 'combo', status: 'enabled' },
      { maxTempF: '88.00' }
    );
    expect(noteWithCooling).toContain('above target 88F');
    expect(noteWithCooling).toContain('Cooling support is configured');

    const noteWithoutCooling = buildTemperatureGuidanceNote(
      94,
      { equipmentType: 'heater', status: 'enabled' },
      { maxTempF: '88.00' }
    );
    expect(noteWithoutCooling).toContain('no active chiller is configured');
  });
});

describe('buildStationAdjustmentNote', () => {
  it('returns null when no station signals are present', () => {
    expect(buildStationAdjustmentNote(null)).toBeNull();
    expect(buildStationAdjustmentNote({})).toBeNull();
  });

  it('adds weather-station guidance notes for strong signals', () => {
    const note = buildStationAdjustmentNote({
      uvIndex: 8,
      airTempF: 92,
      windSpeedMph: 18,
      humidityPercent: 88,
    });

    expect(note).toContain('Station UV indicates elevated daytime chlorine demand.');
    expect(note).toContain('Station air temperature is high, increasing oxidation demand.');
    expect(note).toContain('Wind can increase debris load and sanitizer consumption.');
    expect(note).toContain('High humidity can reduce evaporation-driven cooling.');
  });
});

describe('chooseTemperatureForGuidance', () => {
  it('prefers recent test temperature when not stale', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-22T12:00:00.000Z'));
    expect(
      chooseTemperatureForGuidance(
        81,
        new Date('2026-02-22T06:00:00.000Z'),
        77,
        new Date('2026-02-22T11:30:00.000Z')
      )
    ).toBe(81);
    vi.useRealTimers();
  });

  it('falls back to sensor temperature when test temperature is stale', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-22T12:00:00.000Z'));
    expect(
      chooseTemperatureForGuidance(
        81,
        new Date('2026-02-20T08:00:00.000Z'),
        77,
        new Date('2026-02-22T11:30:00.000Z')
      )
    ).toBe(77);
    vi.useRealTimers();
  });
});
