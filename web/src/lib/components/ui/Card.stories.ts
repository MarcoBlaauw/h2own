import type { Meta, StoryObj } from '@storybook/sveltekit';
import Card from './Card.svelte';

const meta = {
  title: 'UI/Card',
  component: Card,
  tags: ['autodocs'],
  argTypes: {
    status: {
      control: { type: 'select' },
      options: ['default', 'success', 'warning', 'danger', 'info']
    }
  },
  args: {
    className: '',
    status: 'default'
  },
  render: (args) => ({
    Component: Card,
    props: args,
    slots: {
      default: 'Card content rendered with semantic tokens.'
    }
  })
} satisfies Meta<Card>;

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

export const Success: Story = {
  args: { status: 'success' },
  globals: { theme: 'light' }
};

export const DangerDark: Story = {
  args: { status: 'danger' },
  globals: { theme: 'dark' }
};
