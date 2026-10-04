import {
  BlurFilter,
  Frame,
  GroundShadow,
  type Icon3DProps,
  LitGradient,
  PICK_PATH,
  PaleGradient,
  Specular,
  Tile,
  TileGradient,
  color,
  useIconIds,
} from './recipe';

const white = { fill: color('surface') };

/** Guitar pick (Upload drop zone, Pick drop moment). */
export function Pick(props: Icon3DProps) {
  const id = useIconIds('body', 'blur');
  return (
    <Frame {...props}>
      <defs>
        <LitGradient id={id.body} tone="orange" />
        <BlurFilter id={id.blur} />
      </defs>
      <GroundShadow filter={id.blur} tone="orange" rx={13} />
      <path d={PICK_PATH} fill={`url(#${id.body})`} />
      <path d={PICK_PATH} transform="translate(32 30) scale(0.78) translate(-32 -30)" style={{ fill: 'none', stroke: color('surface'), strokeOpacity: 0.22, strokeWidth: 1.5 }} />
      <Specular cx={24} cy={18} rx={6} ry={3} />
    </Frame>
  );
}

/** Metronome (Listening screen still frame). */
export function Metronome(props: Icon3DProps) {
  const id = useIconIds('body', 'weight', 'blur');
  return (
    <Frame {...props}>
      <defs>
        <linearGradient id={id.body} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style={{ stopColor: color('violet', 'soft') }} />
          <stop offset="0.35" style={{ stopColor: color('violet') }} />
          <stop offset="1" style={{ stopColor: color('violet', 'deep') }} />
        </linearGradient>
        <LitGradient id={id.weight} tone="orange" />
        <BlurFilter id={id.blur} />
      </defs>
      <GroundShadow filter={id.blur} tone="violet" rx={21} cy={60} />
      <path d="M13 54L25 10Q32 3 39 10L51 54Z" fill={`url(#${id.body})`} />
      <path d="M21 47L28 16H36L43 47Z" style={{ fill: color('violet', 'soft'), opacity: 0.85 }} />
      {[22, 28, 34, 40].map((y) => (
        <path key={y} d={`M${30.5 - (y - 16) * 0.05} ${y}H${33.5 + (y - 16) * 0.05}`} style={{ stroke: color('violet'), strokeWidth: 1.2, opacity: 0.5 }} />
      ))}
      <rect x="10" y="52" width="44" height="6" rx="3" style={{ fill: color('violet', 'deep') }} />
      <path d="M32 46L42.5 13" style={{ stroke: color('ink'), strokeWidth: 2.6, strokeLinecap: 'round' }} />
      <rect x="34" y="21" width="11" height="8.5" rx="3" transform="rotate(17 39.5 25.2)" fill={`url(#${id.weight})`} />
      <circle cx="32" cy="46" r="3" style={{ fill: color('violet', 'deep') }} />
      <Specular cx={21} cy={24} rx={1.8} ry={8} rotate={15} opacity={0.45} />
    </Frame>
  );
}

const WAVE = [
  { h: 12, tone: 'surface' },
  { h: 22, tone: 'surface' },
  { h: 30, tone: 'orange' },
  { h: 18, tone: 'surface' },
  { h: 26, tone: 'surface' },
  { h: 32, tone: 'mint' },
  { h: 14, tone: 'surface' },
] as const;

/** Waveform tile (Listening loop still frame, file tile). */
export function WaveformTile(props: Icon3DProps) {
  const id = useIconIds('tile', 'blur');
  return (
    <Frame {...props}>
      <defs>
        <TileGradient id={id.tile} tone="violet" />
        <BlurFilter id={id.blur} />
      </defs>
      <GroundShadow filter={id.blur} tone="violet" />
      <Tile gradient={id.tile} />
      {WAVE.map((bar, i) => (
        <rect
          key={i}
          x={14.2 + i * 5.6}
          y={32 - bar.h / 2}
          width="3.6"
          height={bar.h}
          rx="1.8"
          style={{ fill: color(bar.tone) }}
        />
      ))}
    </Frame>
  );
}

const BALLS = [
  { cx: 17, cy: 43, r: 5 },
  { cx: 27, cy: 36, r: 5.5 },
  { cx: 38, cy: 28, r: 6 },
  { cx: 48, cy: 20, r: 6.5 },
];

/** Arpeggio style: notes rising one after another. */
export function Arpeggio(props: Icon3DProps) {
  const id = useIconIds('tile', 'ball', 'blur');
  return (
    <Frame {...props}>
      <defs>
        <TileGradient id={id.tile} tone="violet" />
        <PaleGradient id={id.ball} />
        <BlurFilter id={id.blur} />
      </defs>
      <GroundShadow filter={id.blur} tone="violet" />
      <Tile gradient={id.tile} />
      {BALLS.map((b, i) => (
        <g key={i}>
          <ellipse cx={b.cx + 1} cy={b.cy + b.r + 1.5} rx={b.r * 0.8} ry="1.2" style={{ fill: color('violet', 'deep'), opacity: 0.35 }} />
          <circle cx={b.cx} cy={b.cy} r={b.r} fill={`url(#${id.ball})`} />
          <circle cx={b.cx - b.r * 0.35} cy={b.cy - b.r * 0.38} r={b.r * 0.22} style={{ ...white, opacity: 0.9 }} />
        </g>
      ))}
    </Frame>
  );
}

/** Fingerstyle style: strings and a pick. */
export function Fingerstyle(props: Icon3DProps) {
  const id = useIconIds('tile', 'pick', 'blur');
  return (
    <Frame {...props}>
      <defs>
        <TileGradient id={id.tile} tone="mint" />
        <LitGradient id={id.pick} tone="orange" />
        <BlurFilter id={id.blur} />
      </defs>
      <GroundShadow filter={id.blur} tone="mint" />
      <Tile gradient={id.tile} />
      {[0, 1, 2, 3].map((i) => (
        <path
          key={i}
          d={`M11 ${27 + i * 6.5}L53 ${19 + i * 6.5}`}
          style={{ stroke: color('surface'), strokeWidth: 1.2 + i * 0.45, strokeLinecap: 'round', opacity: 0.92 }}
        />
      ))}
      <g transform="translate(39 39) rotate(-25) scale(0.42) translate(-32 -31)">
        <path d={PICK_PATH} fill={`url(#${id.pick})`} />
        <Specular cx={24} cy={18} rx={6} ry={3} />
      </g>
    </Frame>
  );
}

const FAN_RIBS: Array<[number, number]> = [
  [16.9, 27.4],
  [26.6, 22.6],
  [37.4, 22.6],
  [47.1, 27.4],
];

/** Flamenco style: an open fan. */
export function Flamenco(props: Icon3DProps) {
  const id = useIconIds('tile', 'fan', 'blur');
  return (
    <Frame {...props}>
      <defs>
        <TileGradient id={id.tile} tone="rose" />
        <PaleGradient id={id.fan} />
        <BlurFilter id={id.blur} />
      </defs>
      <GroundShadow filter={id.blur} tone="rose" />
      <Tile gradient={id.tile} />
      <path d="M32 46L10.3 35.9A24 24 0 0 1 53.7 35.9Z" fill={`url(#${id.fan})`} />
      <path d="M32 46L16.9 27.4A24 24 0 0 1 26.6 22.6Z" style={{ fill: color('rose', 'soft') }} />
      <path d="M32 46L37.4 22.6A24 24 0 0 1 47.1 27.4Z" style={{ fill: color('rose', 'soft') }} />
      {FAN_RIBS.map(([x, y], i) => (
        <path key={i} d={`M32 46L${x} ${y}`} style={{ stroke: color('rose', 'deep'), strokeWidth: 1, opacity: 0.45 }} />
      ))}
      <path d="M10.3 35.9A24 24 0 0 1 53.7 35.9" style={{ fill: 'none', stroke: color('rose', 'deep'), strokeWidth: 1.6, opacity: 0.6 }} />
      <rect x="29.5" y="45" width="5" height="9" rx="2.5" style={{ fill: color('rose', 'deep') }} />
      <circle cx="32" cy="46" r="2.6" style={{ fill: color('surface') }} />
    </Frame>
  );
}

/** Play sphere (player bar, sample clip). */
export function PlaySphere(props: Icon3DProps) {
  const id = useIconIds('body', 'blur');
  return (
    <Frame {...props}>
      <defs>
        <LitGradient id={id.body} tone="violet" />
        <BlurFilter id={id.blur} />
      </defs>
      <GroundShadow filter={id.blur} tone="violet" rx={16} cy={58} />
      <circle cx="32" cy="30" r="23" fill={`url(#${id.body})`} />
      <path
        d="M27.5 20.5L42.5 30L27.5 39.5Z"
        style={{ ...white, stroke: color('surface'), strokeWidth: 3, strokeLinejoin: 'round' }}
      />
      <Specular cx={22} cy={18} rx={6.5} ry={3.5} opacity={0.5} />
    </Frame>
  );
}

/** Check badge (confirmed chord, completed step). */
export function CheckBadge(props: Icon3DProps) {
  const id = useIconIds('body', 'blur');
  return (
    <Frame {...props}>
      <defs>
        <LitGradient id={id.body} tone="mint" />
        <BlurFilter id={id.blur} />
      </defs>
      <GroundShadow filter={id.blur} tone="mint" rx={16} cy={58} />
      <circle cx="32" cy="31" r="23" fill={`url(#${id.body})`} />
      <circle cx="32" cy="31" r="23" style={{ fill: 'none', stroke: color('mint', 'deep'), strokeWidth: 3, opacity: 0.35 }} />
      <path
        d="M21.5 31.5L28.5 38.5L43 24"
        style={{ fill: 'none', stroke: color('surface'), strokeWidth: 5.5, strokeLinecap: 'round', strokeLinejoin: 'round' }}
      />
      <Specular cx={22} cy={19} rx={6} ry={3.2} opacity={0.5} />
    </Frame>
  );
}

/** Upload arrow (drop zone, Upload step). */
export function Upload(props: Icon3DProps) {
  const id = useIconIds('tile', 'blur');
  return (
    <Frame {...props}>
      <defs>
        <TileGradient id={id.tile} tone="violet" />
        <BlurFilter id={id.blur} />
      </defs>
      <GroundShadow filter={id.blur} tone="violet" />
      <Tile gradient={id.tile} />
      <path
        d="M32 15L44 28H36.5V40H27.5V28H20Z"
        style={{ ...white, stroke: color('surface'), strokeWidth: 2.5, strokeLinejoin: 'round' }}
      />
      <path
        d="M18 42V46A3.5 3.5 0 0 0 21.5 49.5H42.5A3.5 3.5 0 0 0 46 46V42"
        style={{ fill: 'none', stroke: color('surface'), strokeWidth: 3.5, strokeLinecap: 'round', opacity: 0.9 }}
      />
    </Frame>
  );
}
