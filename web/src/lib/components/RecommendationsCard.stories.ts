import type { Meta, StoryObj } from '@storybook/svelte';
import RecommendationsCard from './RecommendationsCard.svelte';

const meta = {
  title: 'Cards/Recommendations',
  component: RecommendationsCard,
  tags: ['autodocs'],
  render: (args) => ({
    Component: RecommendationsCard,
    props: args
  })
} satisfies Meta<RecommendationsCard>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleRecommendations = {
  primary: {
    chemicalId: 'chem-1',
    chemicalName: 'Chlorine',
    amount: 12.5,
    unit: 'oz',
    reason: 'Free chlorine is low at 1.2 ppm.',
    predictedOutcome: 'Raise free chlorine to approximately 3 ppm.'
  },
  alternatives: [
    {
      chemicalId: 'chem-2',
      chemicalName: 'Liquid Chlorine',
      amount: 16,
      unit: 'oz',
      reason: 'Free chlorine is low at 1.2 ppm.',
      predictedOutcome: 'Raise free chlorine to approximately 3 ppm.'
    }
  ]
};

const savedRecommendations = [
  {
    recommendationId: 'rec-1',
    type: 'chemical_dose',
    title: 'Add 12.5 oz Chlorine',
    description: 'Free chlorine is low at 1.2 ppm.',
    payload: { chemicalId: 'chem-1' },
    status: 'pending',
    createdAt: new Date().toISOString()
  },
  {
    recommendationId: 'rec-2',
    type: 'chemical_dose',
    title: 'Add 16 oz Liquid Chlorine',
    description: 'Free chlorine is low at 1.2 ppm.',
    payload: { chemicalId: 'chem-2' },
    status: 'applied',
    createdAt: new Date().toISOString()
  }
];

const baseArgs = {
  poolId: 'pool-1',
  latestTestId: 'test-1',
  recommendations: sampleRecommendations,
  savedRecommendations,
  hasTest: true
};

export const Light: Story = {
  args: baseArgs,
  globals: { theme: 'light' }
};

export const Dark: Story = {
  args: baseArgs,
  globals: { theme: 'dark' }
};
