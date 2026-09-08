type IllustrationProps = {
  className?: string;
};

/**
 * "All clear" graphic for the civilian dashboard's empty state -- a shield
 * with a checkmark and a few soft sparkle accents, in the warm-orange
 * civilian palette. Flat geometric shapes only (circles, a shield path, a
 * checkmark stroke), same hand-coded-SVG technique as EmblemIcon -- no
 * traced or sourced artwork.
 */
export function NoComplaintsIllustration({ className }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 160 140"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="80" cy="72" r="58" fill="var(--warm-accent)" opacity="0.1" />

      {/* Sparkle accents -- small diamonds at varying sizes/positions */}
      <path d="M30 40 L34 48 L30 56 L26 48 Z" fill="var(--warm-accent)" opacity="0.35" />
      <path d="M126 88 L130 94 L126 100 L122 94 Z" fill="var(--warm-accent)" opacity="0.35" />
      <path d="M118 32 L121 38 L118 44 L115 38 Z" fill="var(--warm-accent)" opacity="0.3" />

      {/* Shield */}
      <path
        d="M80 22 L114 34 V64 C114 92 98 110 80 118 C62 110 46 92 46 64 V34 Z"
        fill="var(--warm-accent)"
        opacity="0.9"
      />
      <path
        d="M80 22 L114 34 V64 C114 92 98 110 80 118 C62 110 46 92 46 64 V34 Z"
        fill="none"
        stroke="var(--background)"
        strokeOpacity="0.15"
        strokeWidth="2"
      />

      {/* Checkmark */}
      <path
        d="M62 68 L75 81 L100 52"
        fill="none"
        stroke="var(--background)"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
