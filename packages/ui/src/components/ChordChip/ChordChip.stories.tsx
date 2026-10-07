import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChordChip } from './ChordChip';

const meta: Meta<typeof ChordChip> = { title: 'Components/ChordChip', component: ChordChip };
export default meta;
type Story = StoryObj<typeof ChordChip>;

const Row = () => (
  <div style={{ display: 'flex', gap: 'var(--space-6)', fontWeight: 700 }}>
    <ChordChip bar={1}>G</ChordChip>
    <ChordChip bar={2} status="check">Em</ChordChip>
    <ChordChip bar={3} status="likely">C</ChordChip>
    <ChordChip bar={4} status="yours">D</ChordChip>
  </div>
);

export const Default: Story = { render: () => <Row /> };
export const Hover: Story = { render: () => <div data-force-state="hover"><Row /></div> };
export const Focus: Story = {
  render: () => <Row />,
  play: ({ canvasElement }) => {
    canvasElement.querySelectorAll<HTMLButtonElement>('button')[1]?.focus();
  },
};
export const Disabled: Story = { render: () => <ChordChip bar={1} disabled>G</ChordChip> };
export const ReducedMotion: Story = { render: () => <Row />, parameters: { reducedMotion: true } };
