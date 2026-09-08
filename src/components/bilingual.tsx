import type { ElementType, ReactNode } from "react";

type BilingualProps = {
  en: ReactNode;
  hi: string;
  as?: ElementType;
  className?: string;
  hiClassName?: string;
};

/**
 * English as the primary text with a smaller Hindi line beneath it -- the
 * bilingual label pattern used throughout government-facing apps like
 * DigiLocker and mParivahan. `as` picks the wrapping tag (defaults to a
 * plain span so this drops into buttons/badges without breaking their
 * layout); `hiClassName` overrides the Hindi line's sizing for contexts
 * that need something other than the small-label default (e.g. a hero
 * heading's subtitle).
 */
export function Bilingual({
  en,
  hi,
  as: Tag = "span",
  className,
  hiClassName = "block text-xs font-normal text-muted",
}: BilingualProps) {
  return (
    <Tag className={className}>
      {en}
      <span className={hiClassName}>{hi}</span>
    </Tag>
  );
}

/**
 * Compact same-line variant -- "English · हिंदी" -- for badges, pills, and
 * other tight inline contexts where a stacked block would break the shape.
 */
export function BilingualInline({ en, hi }: { en: ReactNode; hi: string }) {
  return (
    <>
      {en} <span className="opacity-80">· {hi}</span>
    </>
  );
}
