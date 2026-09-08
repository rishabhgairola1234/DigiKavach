type EmblemIconProps = {
  className?: string;
};

const LION_HEADS = [
  { cx: 18, cy: 32, r: 8 },
  { cx: 46, cy: 32, r: 8 },
  { cx: 32, cy: 23.5, r: 10.5 },
];

const CHAKRA_SPOKES = 8;

// Every shape below is generated from plain trigonometry rather than traced
// coordinates -- a stylized "sunburst" medallion (mane spikes fanning out
// from a solid face circle) stands in for a lion head, repeated three times,
// over a simplified spoked-wheel motif. This is an original illustration
// evoking (not reproducing) the visual language of Indian government
// insignia -- geometric and single-color by design, so it survives the
// State Emblem's "no realistic imitation" line and stays crisp at the small
// sizes a navbar icon actually renders at.
function maneSpikePoints(cx: number, cy: number, r: number, spikeCount = 9): string[] {
  const innerR = r;
  const outerR = r * 1.85;
  const halfWidth = (Math.PI / spikeCount) * 0.55;

  return Array.from({ length: spikeCount }, (_, i) => {
    const angle = (i / spikeCount) * Math.PI * 2;
    const a1 = angle - halfWidth;
    const a2 = angle + halfWidth;
    const outer = [cx + outerR * Math.sin(angle), cy - outerR * Math.cos(angle)];
    const p1 = [cx + innerR * Math.sin(a1), cy - innerR * Math.cos(a1)];
    const p2 = [cx + innerR * Math.sin(a2), cy - innerR * Math.cos(a2)];
    return `${p1.join(",")} ${outer.join(",")} ${p2.join(",")}`;
  });
}

export function EmblemIcon({ className }: EmblemIconProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {LION_HEADS.map((lion, i) => (
        <g key={i}>
          {maneSpikePoints(lion.cx, lion.cy, lion.r).map((points, j) => (
            <polygon key={j} points={points} />
          ))}
          <circle cx={lion.cx} cy={lion.cy} r={lion.r} />
        </g>
      ))}

      {/* Abacus / base band */}
      <rect x="9" y="42" width="46" height="9" rx="2.5" />

      {/* Simplified spoked-wheel motif, centered on the band -- protrudes
          above/below it so its rim reads clearly even in one flat color. */}
      <g transform="translate(32, 46.5)">
        <circle r="5.4" fill="none" stroke="currentColor" strokeWidth="1.4" />
        {Array.from({ length: CHAKRA_SPOKES }, (_, i) => {
          const angle = (i / CHAKRA_SPOKES) * Math.PI * 2;
          const x2 = 5.4 * Math.sin(angle);
          const y2 = -5.4 * Math.cos(angle);
          return <line key={i} x1={0} y1={0} x2={x2} y2={y2} stroke="currentColor" strokeWidth="1.2" />;
        })}
        <circle r="1.3" fill="currentColor" />
      </g>

      {/* Plinth */}
      <rect x="5" y="53" width="54" height="4" rx="1.5" />
    </svg>
  );
}
