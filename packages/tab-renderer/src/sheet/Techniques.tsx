import { GEOMETRY, type TechMark } from '../layout/layout';
import styles from './TabSheet.module.css';

/** Centre line of the technique lane. */
const LANE_Y = GEOMETRY.chordLane + GEOMETRY.techLane / 2;

export function Technique({ mark, colWidth }: { mark: TechMark; colWidth: number }) {
  switch (mark.kind) {
    case 'slur': {
      const mid = (mark.x1 + mark.x2) / 2;
      const top = mark.y - 15;
      return (
        <g data-tech="slur">
          <path className={styles['slur']} d={`M${mark.x1 + 3} ${mark.y - 8}Q${mid} ${top - 4} ${mark.x2 - 3} ${mark.y - 8}`} />
          <text className={styles['techLabel']} x={mid} y={top - 3} textAnchor="middle">
            {mark.label}
          </text>
        </g>
      );
    }
    case 'accent':
      return <path data-tech="accent" className={styles['stroke']} d={`M${mark.x - 4} ${LANE_Y - 4}L${mark.x + 4} ${LANE_Y}L${mark.x - 4} ${LANE_Y + 4}`} />;
    case 'rasgueo': {
      // MUSIC-REVIEW: Guitar Pro convention — a down stroke (bass to treble) points up the tab.
      const x = mark.x - colWidth * 0.42;
      const [from, to] = mark.direction === 'down' ? [mark.y2 + 4, mark.y1 - 6] : [mark.y1 - 4, mark.y2 + 6];
      const dir = Math.sign(to - from);
      return (
        <g data-tech="rasgueo" data-direction={mark.direction}>
          <path className={styles['stroke']} d={`M${x} ${from}L${x} ${to - dir * 4}`} />
          <path className={styles['head']} d={`M${x - 3.5} ${to - dir * 5}L${x + 3.5} ${to - dir * 5}L${x} ${to}Z`} />
        </g>
      );
    }
    case 'golpe':
      return (
        <g data-tech="golpe" className={styles['golpe']}>
          <rect x={mark.x - 8} y={LANE_Y - 8} width={16} height={16} rx={4} />
          <text x={mark.x} y={LANE_Y} textAnchor="middle" dominantBaseline="central">
            G
          </text>
        </g>
      );
    case 'pinch': {
      // A bracket hugging the pinched notes, so it can't be mistaken for a bar line.
      const x = mark.x - 9;
      return (
        <path
          data-tech="pinch"
          className={styles['pinch']}
          d={`M${x + 3} ${mark.y1 - 6}H${x}V${mark.y2 + 6}H${x + 3}`}
        />
      );
    }
    case 'apoyando':
      return <path data-tech="apoyando" className={styles['apoyando']} d={`M${mark.x - 4.5} ${LANE_Y + 3}L${mark.x} ${LANE_Y - 4}L${mark.x + 4.5} ${LANE_Y + 3}Z`} />;
    case 'tremolo':
      return (
        <path
          data-tech="tremolo"
          className={styles['stroke']}
          d={[-4, 0, 4].map((dx) => `M${mark.x + dx - 2.5} ${LANE_Y + 4}L${mark.x + dx + 2.5} ${LANE_Y - 4}`).join('')}
        />
      );
  }
}
