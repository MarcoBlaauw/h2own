import { describe, expect, it } from 'vitest';
import { buildWeatherAdjustmentNote } from './recommender.js';

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
