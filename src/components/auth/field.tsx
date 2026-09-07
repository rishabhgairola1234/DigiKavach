export function Field({
  label,
  name,
  type,
  autoComplete,
  focusClassName = "focus:border-accent",
}: {
  label: string;
  name: string;
  type: string;
  autoComplete?: string;
  focusClassName?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        required
        className={`rounded-lg border border-border bg-background px-3 py-2.5 text-foreground outline-none transition-colors placeholder:text-muted ${focusClassName}`}
      />
    </label>
  );
}
