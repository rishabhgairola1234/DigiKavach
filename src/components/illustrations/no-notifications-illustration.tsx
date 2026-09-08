type IllustrationProps = {
  className?: string;
};

/**
 * Compact "you're all caught up" graphic for the notification bell's empty
 * state -- a bell with a checkmark badge, sized to sit comfortably in the
 * small notification dropdown rather than a full-width empty state.
 */
export function NoNotificationsIllustration({ className }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="32" cy="32" r="30" fill="var(--warm-accent)" opacity="0.1" />

      {/* Bell */}
      <path
        d="M32 12 C24 12 20 18 20 26 V32 C20 37 18 40 15 42 H49 C46 40 44 37 44 32 V26 C44 18 40 12 32 12 Z"
        fill="var(--muted)"
        opacity="0.9"
      />
      <path
        d="M26 45 C26 48.5 28.7 51 32 51 C35.3 51 38 48.5 38 45 Z"
        fill="var(--muted)"
        opacity="0.9"
      />

      {/* Checkmark badge */}
      <circle cx="45" cy="20" r="12" fill="var(--priority-low)" />
      <path
        d="M39.5 20 L43.5 24 L51 15.5"
        fill="none"
        stroke="var(--background)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
