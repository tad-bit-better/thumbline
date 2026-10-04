import { formatClock, formatDuration } from './format';

describe('formatClock', () => {
  it('shows minutes and two-digit seconds', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(24)).toBe('0:24');
    expect(formatClock(84)).toBe('1:24');
    expect(formatClock(600)).toBe('10:00');
  });

  it('rounds down, like a player clock', () => {
    expect(formatClock(23.9)).toBe('0:23');
    expect(formatClock(59.99)).toBe('0:59');
  });

  it('never goes below zero or breaks on bad input', () => {
    expect(formatClock(-0.3)).toBe('0:00');
    expect(formatClock(Number.NaN)).toBe('0:00');
  });
});

describe('formatDuration', () => {
  it('rounds to the nearest second', () => {
    expect(formatDuration(192.4)).toBe('3:12');
    expect(formatDuration(59.6)).toBe('1:00');
  });
});
