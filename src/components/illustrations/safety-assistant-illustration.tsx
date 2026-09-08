type IllustrationProps = {
  className?: string;
};

/**
 * Friendly life-buoy graphic for the Safety Assistant's welcome message --
 * echoes the LifeBuoy icon used to link to this feature elsewhere, with a
 * small heart accent to keep the tone reassuring rather than clinical.
 */
export function SafetyAssistantIllustration({ className }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="60" cy="60" r="54" fill="var(--warm-accent)" opacity="0.1" />

      {/* Life-buoy ring */}
      <circle cx="60" cy="60" r="34" fill="var(--warm-accent)" opacity="0.9" />
      <circle cx="60" cy="60" r="17" fill="var(--background)" />

      {/* Cross bands, alternating a lighter tone for the classic ring pattern */}
      <rect x="56" y="10" width="8" height="24" rx="3" fill="var(--background)" opacity="0.85" />
      <rect x="56" y="86" width="8" height="24" rx="3" fill="var(--background)" opacity="0.85" />
      <rect x="10" y="56" width="24" height="8" rx="3" fill="var(--background)" opacity="0.85" />
      <rect x="86" y="56" width="24" height="8" rx="3" fill="var(--background)" opacity="0.85" />

      <circle cx="60" cy="60" r="34" fill="none" stroke="var(--background)" strokeOpacity="0.15" strokeWidth="2" />

      {/* Small heart accent, top-right -- reassuring rather than clinical */}
      <path
        d="M96 24 C96 21 93.5 19 91 19 C89.3 19 87.8 20 87 21.4 C86.2 20 84.7 19 83 19 C80.5 19 78 21 78 24 C78 29 87 35 87 35 C87 35 96 29 96 24 Z"
        fill="var(--priority-low)"
      />
    </svg>
  );
}
