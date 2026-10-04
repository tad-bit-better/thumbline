import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../Button/Button';
import { Card } from './Card';

const meta: Meta<typeof Card> = {
  title: 'Components/Card',
  component: Card,
  args: { padding: 'md', interactive: false },
  argTypes: { padding: { control: 'inline-radio', options: ['sm', 'md', 'lg'] } },
  render: (args) => (
    <Card {...args} style={{ width: 320 }}>
      <h3 style={{ margin: 0, fontSize: 'var(--text-h3)' }}>Travis picking</h3>
      <p style={{ margin: 'var(--space-2) 0 0', color: 'var(--color-ink-2)' }}>
        The thumb alternates between two bass strings on every beat while the fingers fill the gaps.
      </p>
    </Card>
  ),
};
export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {};

export const Paddings: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'start' }}>
      <Card padding="sm">sm</Card>
      <Card padding="md">md</Card>
      <Card padding="lg">lg</Card>
    </div>
  ),
};

/** Lifts 6px and tilts on hover. */
export const Interactive: Story = { args: { interactive: true } };

export const Hover: Story = {
  args: { interactive: true },
  decorators: [(Story) => <div data-force-state="hover">{Story()}</div>],
};

/** Focus inside an interactive card lifts it too. */
export const Focus: Story = {
  args: { interactive: true },
  render: (args) => (
    <Card {...args} style={{ width: 320 }}>
      <Button variant="ghost">Try another pattern</Button>
    </Card>
  ),
  play: ({ canvasElement }) => {
    canvasElement.querySelector('button')?.focus();
  },
};

export const ReducedMotion: Story = { ...Hover, parameters: { reducedMotion: true } };
