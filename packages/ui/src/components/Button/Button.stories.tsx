import type { Meta, StoryObj } from '@storybook/react-vite';
import { UploadGlyph } from '../glyphs';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  args: { children: 'Choose a file', variant: 'primary', size: 'md' },
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'secondary', 'ghost'] },
    size: { control: 'inline-radio', options: ['md', 'lg'] },
  },
};
export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {};

export const Variants: Story = {
  render: (args) => (
    <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
      <Button {...args} variant="primary" icon={<UploadGlyph />}>
        Choose a file
      </Button>
      <Button {...args} variant="secondary">
        Edit chords
      </Button>
      <Button {...args} variant="ghost">
        or try a sample clip
      </Button>
    </div>
  ),
};

export const Large: Story = { args: { size: 'lg', children: 'Looks good, write my sheets' } };

export const Hover: Story = {
  render: (args) => (
    <div data-force-state="hover" style={{ display: 'flex', gap: 'var(--space-4)' }}>
      <Button {...args}>Primary</Button>
      <Button {...args} variant="secondary">
        Secondary
      </Button>
      <Button {...args} variant="ghost">
        Ghost
      </Button>
    </div>
  ),
};

export const Pressed: Story = {
  render: (args) => (
    <div data-force-state="active">
      <Button {...args} />
    </div>
  ),
};

export const Focus: Story = {
  play: ({ canvasElement }) => {
    canvasElement.querySelector('button')?.focus();
  },
};

export const Disabled: Story = {
  render: (args) => (
    <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
      <Button {...args} disabled>
        Primary
      </Button>
      <Button {...args} variant="secondary" disabled>
        Secondary
      </Button>
      <Button {...args} variant="ghost" disabled>
        Ghost
      </Button>
    </div>
  ),
};

export const ReducedMotion: Story = {
  ...Hover,
  parameters: { reducedMotion: true },
};
