type IllustrationProps = {
  className?: string;
};

/**
 * "Nothing to investigate yet" graphic for the officer dashboard's empty
 * state -- a magnifying glass over a small document stack, in the
 * navy/cyan officer palette. Same flat hand-coded-SVG technique as
 * EmblemIcon/NoComplaintsIllustration -- plain shapes, no traced artwork.
 */
export function NoCasesIllustration({ className }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 160 140"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="78" cy="72" r="58" fill="var(--accent)" opacity="0.1" />

      {/* Document stack -- two offset cards behind the top one */}
      <rect x="34" y="46" width="66" height="82" rx="6" fill="var(--accent)" opacity="0.18" />
      <rect x="44" y="36" width="66" height="82" rx="6" fill="var(--accent)" opacity="0.3" />
      <rect x="54" y="26" width="66" height="82" rx="6" fill="var(--accent-strong)" opacity="0.95" />

      {/* Text lines on the front document */}
      <rect x="66" y="44" width="42" height="5" rx="2.5" fill="var(--background)" opacity="0.35" />
      <rect x="66" y="56" width="30" height="5" rx="2.5" fill="var(--background)" opacity="0.35" />
      <rect x="66" y="68" width="36" height="5" rx="2.5" fill="var(--background)" opacity="0.35" />

      {/* Magnifying glass */}
      <circle
        cx="106"
        cy="98"
        r="20"
        fill="var(--background)"
        stroke="var(--accent-strong)"
        strokeWidth="6"
      />
      <line
        x1="120.5"
        y1="112.5"
        x2="133"
        y2="125"
        stroke="var(--accent-strong)"
        strokeWidth="7"
        strokeLinecap="round"
      />
    </svg>
  );
}
