import type { Meta, StoryObj } from '@storybook/sveltekit';
import RecommendationsCard from './RecommendationsCard.svelte';

const meta = {
  title: 'Cards/Recommendations',
  component: RecommendationsCard,
  tags: ['autodocs'],
  args: {
    recommendations: null,
    hasTest: false
  },
  render: (args) => ({
    Component: RecommendationsCard,
    props: args
  })
} satisfies Meta<RecommendationsCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {
  globals: { theme: 'light' }
};

export const Dark: Story = {
  globals: { theme: 'dark' }
};
