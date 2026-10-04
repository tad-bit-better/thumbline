import type { Meta, StoryObj } from '@storybook/react-vite';
import { Stepper } from './Stepper';

const meta: Meta<typeof Stepper> = {
  title: 'Components/Stepper',
  component: Stepper,
  args: { steps: ['Upload', 'Listen', 'Review', 'Play'], current: 2 },
  argTypes: { current: { control: { type: 'range', min: 0, max: 3 } } },
};
export default meta;
type Story = StoryObj<typeof Stepper>;

export const Default: Story = {};
export const FirstStep: Story = { args: { current: 0 } };
export const LastStep: Story = { args: { current: 3 } };

/** Under 420px of space, done and upcoming labels hide; the current one stays. */
export const Narrow: Story = {
  decorators: [(Story) => <div style={{ width: 340 }}>{Story()}</div>],
};
