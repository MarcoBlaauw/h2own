import type { Meta, StoryObj } from '@storybook/sveltekit';
import Skeleton from './Skeleton.svelte';

const meta = {
  title: 'UI/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
  args: {
    lines: 4
  },
  render: (args) => ({
    Component: Skeleton,
    props: args
  })
} satisfies Meta<Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DefaultLight: Story = {
  name: 'Default (Light)',
  globals: { theme: 'light' }
};

export const DenseDark: Story = {
  name: 'Dense (Dark)',
  args: { lines: 6 },
  globals: { theme: 'dark' }
};
