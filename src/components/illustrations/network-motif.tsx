type IllustrationProps = {
  className?: string;
};

/**
 * Extremely subtle "citizens connected to officers" decoration for the
 * homepage hero -- a few nodes joined by lines, echoing the tagline
 * ("One platform connecting citizens... with officers..."). Meant to sit
 * far back in z-order at low opacity alongside the existing ambient glows,
 * never competing with the emblem or portal cards for attention.
 */
export function NetworkMotif({ className }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 400 200"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <g stroke="var(--accent-strong)" strokeWidth="1.5">
        <line x1="60" y1="150" x2="150" y2="60" />
        <line x1="150" y1="60" x2="250" y2="90" />
        <line x1="250" y1="90" x2="340" y2="40" />
        <line x1="150" y1="60" x2="200" y2="160" />
        <line x1="250" y1="90" x2="200" y2="160" />
      </g>
      <circle cx="60" cy="150" r="5" fill="var(--warm-accent)" />
      <circle cx="150" cy="60" r="6" fill="var(--accent-strong)" />
      <circle cx="250" cy="90" r="6" fill="var(--accent-strong)" />
      <circle cx="340" cy="40" r="5" fill="var(--warm-accent)" />
      <circle cx="200" cy="160" r="5" fill="var(--accent-strong)" />
    </svg>
  );
}
