import { useId } from 'react';
import { Arpeggio, Fingerstyle, Flamenco } from '../../icons3d';
import { Card } from '../Card/Card';
import { Chip } from '../Chip/Chip';
import styles from './StyleCard.module.css';

export type StyleKind = 'arpeggio' | 'fingerstyle' | 'flamenco';

const LOOK = {
  arpeggio: { Icon: Arpeggio, tone: 'violet' },
  fingerstyle: { Icon: Fingerstyle, tone: 'mint' },
  flamenco: { Icon: Flamenco, tone: 'rose' },
} as const;

export type StyleCardProps = {
  kind: StyleKind;
  title: string;
  hint: string;
  /** e.g. "Rumba" for flamenco. */
  sublabel?: string;
  /** Makes the card a radio; cards sharing a `name` form one group. */
  onSelect?: () => void;
  name?: string;
  selected?: boolean;
  disabled?: boolean;
  /** Match the page outline; 3 under a section heading, 2 right under the page title. */
  headingLevel?: 2 | 3 | 4;
  className?: string;
};

/** 3D icon, title and hint for a picking style; selectable as a radio. */
export function StyleCard({ kind, title, hint, sublabel, onSelect, name, selected = false, disabled, headingLevel = 3, className }: StyleCardProps) {
  const Heading = `h${headingLevel}` as const;
  const id = useId();
  const { Icon, tone } = LOOK[kind];
  const selectable = onSelect !== undefined;
  return (
    <Card
      interactive={selectable}
      className={[styles['card'], selectable && styles['selectable'], className].filter(Boolean).join(' ')}
      data-tone={tone}
    >
      {selectable && (
        <input
          type="radio"
          className={styles['input']}
          name={name}
          value={kind}
          checked={selected}
          disabled={disabled}
          onChange={onSelect}
          aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-hint`}
        />
      )}
      <Icon size={72} />
      <Heading id={`${id}-title`} className={styles['title']}>
        {title}
      </Heading>
      {sublabel && <Chip tone={tone}>{sublabel}</Chip>}
      <p id={`${id}-hint`} className={styles['hint']}>
        {hint}
      </p>
    </Card>
  );
}
