import type { Meta, StoryObj } from '@storybook/react-vite';
import { Logo, LogoMark } from './Logo';

const meta: Meta<typeof Logo> = {
  title: 'Foundations/Logo',
  component: Logo,
  args: { size: 40 },
};
export default meta;
type Story = StoryObj<typeof Logo>;

/** The nav lockup. */
export const Default: Story = {};

/** The mark alone from favicon size up. */
export const MarkSizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'end' }}>
      {[16, 32, 48, 64, 128].map((s) => (
        <LogoMark key={s} size={s} />
      ))}
    </div>
  ),
};

/** On the ink colour (dark theme is deferred to v1.1; this checks the mark holds on a dark surface). */
export const OnDark: Story = {
  render: (args) => (
    <div style={{ background: 'var(--color-ink)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', display: 'inline-block' }}>
      <span style={{ color: 'var(--color-surface)' }}>
        <Logo {...args} />
      </span>
    </div>
  ),
};

/** The logo doesn't move: reduced motion changes nothing. */
export const ReducedMotion: Story = { parameters: { reducedMotion: true } };
