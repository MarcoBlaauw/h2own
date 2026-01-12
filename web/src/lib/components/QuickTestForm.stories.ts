import type { Meta, StoryObj } from '@storybook/sveltekit';
import QuickTestForm from './QuickTestForm.svelte';

const meta = {
  title: 'Forms/QuickTestForm',
  component: QuickTestForm,
  tags: ['autodocs'],
  args: {
    poolId: 'pool-123'
  },
  render: (args) => ({
    Component: QuickTestForm,
    props: args
  })
} satisfies Meta<QuickTestForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DefaultLight: Story = {
  name: 'Default (Light)',
  globals: { theme: 'light' }
};

export const DefaultDark: Story = {
  name: 'Default (Dark)',
  globals: { theme: 'dark' }
};
