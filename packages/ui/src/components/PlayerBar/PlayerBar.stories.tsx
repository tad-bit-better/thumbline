import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { PlayerBar, type PlayerMix, type PlayerSpeed } from './PlayerBar';

function Demo({ initialPlaying = false, preparing = false, mixDisabled = false }) {
  const [playing, setPlaying] = useState(initialPlaying);
  const [mix, setMix] = useState<PlayerMix>(mixDisabled ? 'sheet' : 'both');
  const [speed, setSpeed] = useState<PlayerSpeed>(1);
  const [loop, setLoop] = useState(false);
  return (
    <div style={{ width: 'min(1100px, 100vw - 32px)', padding: 'var(--space-6) 0' }}>
      <PlayerBar
        playing={playing}
        preparing={preparing}
        onTogglePlay={() => setPlaying(!playing)}
        title="Fingerstyle, Moderate"
        subtitle={`92 bpm, ${mix === 'both' ? 'sheet and original' : mix}${speed < 1 ? `, ${speed * 100}%` : ''}`}
        mix={mix}
        onMixChange={setMix}
        mixDisabled={mixDisabled}
        speed={speed}
        onSpeedChange={setSpeed}
        loop={loop}
        onLoopChange={setLoop}
      />
    </div>
  );
}

const meta: Meta = { title: 'Components/PlayerBar', parameters: { layout: 'fullscreen' } };
export default meta;

export const Default: StoryObj = { render: () => <Demo /> };
export const Playing: StoryObj = { render: () => <Demo initialPlaying /> };
export const Preparing: StoryObj = { render: () => <Demo preparing /> };
/** Without the original recording only the sheet can play. */
export const SheetOnly: StoryObj = { render: () => <Demo mixDisabled /> };
export const Focus: StoryObj = {
  render: () => <Demo />,
  play: ({ canvasElement }) => {
    canvasElement.querySelector('button')?.focus();
  },
};
export const ReducedMotion: StoryObj = { render: () => <Demo />, parameters: { reducedMotion: true } };
