import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import AiMaintenanceAdvisorCard from './AiMaintenanceAdvisorCard.svelte';

describe('AiMaintenanceAdvisorCard', () => {
  it('renders phased read-only advisory with safety assumptions', () => {
    const { getByText } = render(AiMaintenanceAdvisorCard, {
      props: {
        poolName: 'Backyard Pool',
        hasLatestTest: true,
        recommendations: {
          primary: {
            chemicalId: 'chem-1',
            chemicalName: 'Liquid Chlorine',
            amount: 24,
            unit: 'oz',
            reason: 'Free chlorine is below target',
            predictedOutcome: 'Restores FC toward the midpoint target',
          },
          alternatives: [],
        },
        weatherDaily: [
          {
            uvIndex: 8,
            rainfallIn: '0.30',
            airTempF: 92,
          },
        ],
        dosingHistoryCount: 3,
      },
    });

    expect(getByText('AI Maintenance Advisor (Beta)')).toBeTruthy();
    expect(getByText('Phase 1: Stabilize')).toBeTruthy();
    expect(getByText(/Dose 24 oz Liquid Chlorine/)).toBeTruthy();
    expect(getByText(/high UV, recent rain, high heat/)).toBeTruthy();
    expect(getByText('Assumptions and safety')).toBeTruthy();
    expect(getByText(/advisory-only/)).toBeTruthy();
  });

  it('falls back to low-confidence guidance when no latest test is available', () => {
    const { getByText } = render(AiMaintenanceAdvisorCard, {
      props: {
        poolName: 'Backyard Pool',
        hasLatestTest: false,
        recommendations: {
          primary: null,
          alternatives: [],
        },
        weatherDaily: [],
        dosingHistoryCount: 0,
      },
    });

    expect(getByText('Confidence: Low')).toBeTruthy();
    expect(getByText(/Run a new water test/)).toBeTruthy();
    expect(getByText(/Start logging dosing actions/)).toBeTruthy();
  });
});
