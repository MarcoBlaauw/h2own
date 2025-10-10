import type { Meta, StoryObj } from '@storybook/svelte';
import Metric from './Metric.svelte';

const meta = {
  title: 'UI/Metric',
  component: Metric,
  tags: ['autodocs'],
  argTypes: {
    trend: {
      control: { type: 'select' },
      options: ['flat', 'up', 'down']
    }
  },
  args: {
    label: 'Free Chlorine',
    value: '3.0 ppm',
    hint: 'Target range 3–5 ppm',
    trend: 'flat'
  },
  render: (args) => ({
    Component: Metric,
    props: args
  })
} satisfies Meta<Metric>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FlatLight: Story = {
  name: 'Flat (Light)',
  globals: { theme: 'light' }
};

export const RisingDark: Story = {
  name: 'Rising (Dark)',
  args: { trend: 'up' },
  globals: { theme: 'dark' }
};

export const FallingLight: Story = {
  name: 'Falling (Light)',
  args: { trend: 'down' },
  globals: { theme: 'light' }
};
