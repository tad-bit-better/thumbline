import type { Voicing } from '@thumbline/engine';
import styles from './diagram.module.css';

const X0 = 14;
const STRING_GAP = 10;
const Y0 = 32;
const FRET_GAP = 13;
const FRETS_SHOWN = 4;

export type ChordDiagramProps = {
  voicing: Voicing;
  /** Rendered width in px; the drawing scales. */
  size?: number;
  className?: string;
};

/** Fretboard diagram for one shape: nut or base fret, open/muted markers, dots and barre. */
export function ChordDiagram({ voicing, size = 76, className }: ChordDiagramProps) {
  const { frets, name, rootString } = voicing;
  const fretted = frets.filter((f) => f > 0);
  const max = fretted.length ? Math.max(...fretted) : 0;
  const base = max <= FRETS_SHOWN ? 1 : Math.min(...fretted);
  const x = (s: number) => X0 + s * STRING_GAP;
  const y = (f: number) => Y0 + (f - base + 0.5) * FRET_GAP;

  const barreFret = voicing.barre && fretted.length ? Math.min(...fretted) : null;
  const barred = barreFret === null ? [] : frets.flatMap((f, s) => (f === barreFret ? [s] : []));
  const barreFrom = barred[0];
  const barreTo = barred[barred.length - 1];
  const underBarre = (s: number, f: number) => barreFret !== null && f === barreFret && s >= barreFrom && s <= barreTo;

  const height = voicing.simplified ? 108 : 96;
  const label = `${name} chord shape, low to high: ${frets.map((f) => (f < 0 ? 'x' : f)).join(' ')}`;

  return (
    <svg
      className={[styles['diagram'], className].filter(Boolean).join(' ')}
      width={size}
      height={(size * height) / 76}
      viewBox={`0 0 76 ${height}`}
      role="img"
      aria-label={label}
    >
      <text className={styles['name']} x={X0 + 2.5 * STRING_GAP} y={13} textAnchor="middle">
        {name}
      </text>
      {frets.map((_, s) => (
        <line key={`s${s}`} className={styles['string']} x1={x(s)} x2={x(s)} y1={Y0} y2={Y0 + FRETS_SHOWN * FRET_GAP} />
      ))}
      {Array.from({ length: FRETS_SHOWN + 1 }, (_, f) => (
        <line key={`f${f}`} className={styles['fret']} x1={X0} x2={x(5)} y1={Y0 + f * FRET_GAP} y2={Y0 + f * FRET_GAP} />
      ))}
      {base === 1 ? (
        <line className={styles['nut']} x1={X0} x2={x(5)} y1={Y0} y2={Y0} data-nut="" />
      ) : (
        <text className={styles['baseFret']} x={x(5) + 6} y={Y0 + FRET_GAP * 0.5} dominantBaseline="central" data-base-fret="">
          {base}fr
        </text>
      )}

      {frets.map((f, s) => {
        if (f < 0) {
          return (
            <text key={s} className={styles['marker']} x={x(s)} y={Y0 - 6} textAnchor="middle" data-muted="">
              x
            </text>
          );
        }
        if (f === 0) return <circle key={s} className={styles['open']} cx={x(s)} cy={Y0 - 8} r={2.8} data-open="" />;
        if (underBarre(s, f)) return null;
        return (
          <circle
            key={s}
            className={styles['dot']}
            cx={x(s)}
            cy={y(f)}
            r={3.8}
            data-dot=""
            data-string={s}
            data-root={s === rootString ? '' : undefined}
          />
        );
      })}
      {barreFret !== null && barred.length > 1 && (
        <rect
          className={styles['barre']}
          x={x(barreFrom) - 4.5}
          y={y(barreFret) - 4.5}
          width={x(barreTo) - x(barreFrom) + 9}
          height={9}
          rx={4.5}
          data-barre=""
        />
      )}
      {voicing.simplified && (
        <text className={styles['caption']} x={X0 + 2.5 * STRING_GAP} y={104} textAnchor="middle">
          for {voicing.simplified.from}
        </text>
      )}
    </svg>
  );
}
