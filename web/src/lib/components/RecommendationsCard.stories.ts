import type { Meta, StoryObj } from '@storybook/svelte';
import RecommendationsCard from './RecommendationsCard.svelte';

const meta = {
  title: 'Cards/Recommendations',
  component: RecommendationsCard,
  tags: ['autodocs'],
  render: () => ({
    Component: RecommendationsCard
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
