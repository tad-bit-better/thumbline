import type { Arrangement, Technique } from '@thumbline/engine';
import type { ReactNode } from 'react';
import sheet from '../sheet/TabSheet.module.css';
import styles from './diagram.module.css';

const Symbol = ({ children }: { children: ReactNode }) => (
  <svg width={28} height={20} viewBox="0 0 28 20" aria-hidden="true">
    {children}
  </svg>
);

type Entry = { key: string; when: (techs: Set<Technique | 'accent'>) => boolean; symbol: ReactNode; text: ReactNode };

const ENTRIES: Entry[] = [
  {
    key: 'bass',
    when: () => true,
    symbol: (
      <g className={sheet['note']} data-bass="">
        <rect className={sheet['chip']} x={8} y={2} width={14} height={16} rx={5} />
        <text x={15} y={10} textAnchor="middle" dominantBaseline="central">
          3
        </text>
      </g>
    ),
    text: 'Bass note, played with the thumb',
  },
  {
    key: 'hammer',
    when: (t) => t.has('hammer') || t.has('pull'),
    symbol: (
      <g>
        <path className={sheet['slur']} d="M5 15Q14 3 23 15" />
        <text className={sheet['techLabel']} x={14} y={8} textAnchor="middle">
          h
        </text>
      </g>
    ),
    text: (
      <>
        <strong>h</strong> hammer-on, <strong>p</strong> pull-off: sound the note with the fretting hand
      </>
    ),
  },
  {
    key: 'accent',
    when: (t) => t.has('accent'),
    symbol: <path className={sheet['stroke']} d="M10 6L18 10L10 14" />,
    text: 'Accent: play it louder',
  },
  {
    key: 'rasgueo',
    when: (t) => t.has('rasgueo-down') || t.has('rasgueo-up'),
    symbol: (
      <g>
        <path className={sheet['stroke']} d="M14 18L14 6" />
        <path className={sheet['head']} d="M10.5 7L17.5 7L14 2Z" />
      </g>
    ),
    text: 'Rasgueado: strum the strings in the arrow’s direction',
  },
  {
    key: 'golpe',
    when: (t) => t.has('golpe'),
    symbol: (
      <g className={sheet['golpe']}>
        <rect x={6} y={2} width={16} height={16} rx={4} />
        <text x={14} y={10} textAnchor="middle" dominantBaseline="central">
          G
        </text>
      </g>
    ),
    text: 'Golpe: tap the top of the guitar',
  },
  {
    key: 'pinch',
    when: (t) => t.has('pinch'),
    symbol: <path className={sheet['pinch']} d="M15 2H12V18H15" />,
    text: 'Pinch: thumb and finger together',
  },
  {
    key: 'apoyando',
    when: (t) => t.has('apoyando'),
    symbol: <path className={sheet['apoyando']} d="M9.5 13L14 6L18.5 13Z" />,
    text: 'Apoyando: rest stroke onto the next string',
  },
  {
    key: 'tremolo',
    when: (t) => t.has('tremolo'),
    symbol: <path className={sheet['stroke']} d="M7.5 14L12.5 6M11.5 14L16.5 6M15.5 14L20.5 6" />,
    text: 'Tremolo: repeat the note with p-a-m-i',
  },
];

/** Explains the symbols used in this sheet, plus the finger letters. */
export function TabLegend({ arrangement, className }: { arrangement: Arrangement; className?: string }) {
  const used = new Set<Technique | 'accent'>();
  for (const e of arrangement.events) {
    if (e.tech) used.add(e.tech);
    if (e.accent) used.add('accent');
  }
  return (
    <ul aria-label="Legend" className={[styles['legend'], className].filter(Boolean).join(' ')}>
      {ENTRIES.filter((e) => e.when(used)).map((e) => (
        <li key={e.key}>
          <Symbol>{e.symbol}</Symbol>
          <span>{e.text}</span>
        </li>
      ))}
      <li>
        <span>
          <strong>p</strong> thumb · <strong>i</strong> index · <strong>m</strong> middle · <strong>a</strong> ring ·{' '}
          <strong>c</strong> little
        </span>
      </li>
    </ul>
  );
}
