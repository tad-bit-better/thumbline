import { fireEvent, render, screen } from '@testing-library/react';
import { axeViolations } from '../../testing/axe';
import { ChordPicker, type ChordPickerProps } from './ChordPicker';

const ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const QUALITIES = [
  { value: 'maj', label: 'Major' },
  { value: 'm', label: 'Minor' },
  { value: '7', label: '7' },
];
const nameOf = (root: number, quality: string) => ROOTS[root] + (quality === 'maj' ? '' : quality);

function setup(extra: Partial<ChordPickerProps> = {}) {
  const props: ChordPickerProps = {
    title: 'Bar 5',
    groups: [
      {
        id: 'seg-7',
        choices: [
          { id: 'Am', name: 'Am', tag: 'heard', strength: 1 },
          { id: 'C', name: 'C', strength: 0.6 },
          { id: 'F', name: 'F', strength: 0.4 },
        ],
      },
    ],
    onPick: vi.fn(),
    other: { roots: ROOTS, qualities: QUALITIES, nameOf, onPick: vi.fn() },
    ...extra,
  };
  render(<ChordPicker {...props} />);
  return props;
}

describe('ChordPicker', () => {
  it('lists our suggestions, the one we heard first, and picks one', () => {
    const p = setup();
    expect(screen.getByRole('button', { name: 'Am, what we heard' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'C' }));
    expect(p.onPick).toHaveBeenCalledWith('seg-7', 'C');
  });

  it('takes a chord we didn\'t suggest: a root and a type', () => {
    const p = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Something else' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bb' }));
    fireEvent.click(screen.getByRole('button', { name: 'Minor' }));
    fireEvent.click(screen.getByRole('button', { name: 'Use Bbm' }));
    expect(p.other?.onPick).toHaveBeenCalledWith('seg-7', 10, 'm');
  });

  it('offers to hear the bar and to move to the next chord to check', () => {
    const onHear = vi.fn();
    const onNext = vi.fn();
    setup({ onHear, onNext, nextLabel: 'Next to check (3 left)' });
    fireEvent.click(screen.getByRole('button', { name: 'Hear this bar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next to check (3 left)' }));
    expect(onHear).toHaveBeenCalledOnce();
    expect(onNext).toHaveBeenCalledOnce();
  });

  it('labels each chord of a bar that changes chord', () => {
    setup({
      groups: [
        { id: 'a', label: 'Beats 1–2', choices: [{ id: 'G', name: 'G', strength: 1 }] },
        { id: 'b', label: 'Beats 3–4', choices: [{ id: 'D', name: 'D', tag: 'yours', strength: 1 }] },
      ],
    });
    expect(screen.getByText('Beats 1–2')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'D, your choice' })).toBeTruthy();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <ChordPicker title="Bar 5" groups={[{ id: 'x', choices: [{ id: 'Am', name: 'Am', tag: 'heard', strength: 1 }] }]} onPick={() => undefined} onHear={() => undefined} />,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
