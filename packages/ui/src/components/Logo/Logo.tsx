import { BlurFilter, Frame, GroundShadow, type Icon3DProps, LitGradient, PICK_PATH, Tile, TileGradient, color, useIconIds } from '../../icons3d/recipe';
import { DIGIT_WIDTH, FRETS, PICK_TRANSFORM, RIDGE_WIDTH, SMALL_BELOW, STRINGS_REGION, ridges } from './geometry';
import styles from './Logo.module.css';

/**
 * The Thumbline mark (docs/design/design-system.md, Logo): an orange pick on a
 * violet tile carrying a thumbprint whose outer ridges flow out into the tab's
 * strings, with fret numbers on them: thumb, line. The glossy-toy recipe of the
 * 3D icons. At 32px and under it draws fewer, bolder ridges and no numbers.
 */
export function LogoMark(props: Icon3DProps) {
  const id = useIconIds('tile', 'pick', 'blur', 'clip');
  const detail = (props.size ?? 64) <= SMALL_BELOW ? 'small' : 'full';
  const ridgeColour = color('orange', 'soft');
  return (
    <Frame {...props}>
      <defs>
        <TileGradient id={id.tile} tone="violet" />
        <LitGradient id={id.pick} tone="orange" />
        <BlurFilter id={id.blur} />
        {/* The ridges stay on the pick, except the strings leaving it to the right. */}
        <clipPath id={id.clip}>
          <path d={PICK_PATH} transform={PICK_TRANSFORM} />
          <rect {...STRINGS_REGION} />
        </clipPath>
      </defs>
      <GroundShadow filter={id.blur} tone="violet" />
      <Tile gradient={id.tile} />
      <path d={PICK_PATH} transform={PICK_TRANSFORM} fill={`url(#${id.pick})`} style={{ stroke: ridgeColour, strokeOpacity: 0.9, strokeWidth: 1.4, strokeLinejoin: 'round' }} />
      <g clipPath={`url(#${id.clip})`} style={{ fill: 'none', stroke: ridgeColour, strokeWidth: RIDGE_WIDTH[detail], strokeLinecap: 'round', strokeLinejoin: 'round' }}>
        {ridges(detail).map((d) => (
          <path key={d} d={d} data-ridge="" />
        ))}
      </g>
      {detail === 'full' &&
        FRETS.map(({ x, y, digit, d }) => (
          <g key={digit} data-fret="">
            {/* A fret number sits in a gap in its string, as in a tab. */}
            <rect x={x - 2.1} y={y - 2.6} width={4.2} height={5.2} rx={1.2} fill={`url(#${id.tile})`} />
            <path d={d} style={{ fill: 'none', stroke: ridgeColour, strokeWidth: DIGIT_WIDTH, strokeLinecap: 'round', strokeLinejoin: 'round' }} />
          </g>
        ))}
    </Frame>
  );
}

export type LogoProps = {
  /** Mark size in px; the wordmark scales with it. */
  size?: number;
  className?: string;
};

/** Mark and wordmark side by side (nav, splash). The name is real text, so the lockup reads as "Thumbline". */
export function Logo({ size = 40, className }: LogoProps) {
  return (
    <span className={[styles['logo'], className].filter(Boolean).join(' ')} style={{ ['--logo-size' as string]: `${size}px` }}>
      <LogoMark size={size} />
      <span className={styles['wordmark']}>Thumbline</span>
    </span>
  );
}
