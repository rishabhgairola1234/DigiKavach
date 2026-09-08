export function Field({
  label,
  labelHi,
  name,
  type,
  autoComplete,
  focusClassName = "focus:border-accent",
}: {
  label: string;
  labelHi?: string;
  name: string;
  type: string;
  autoComplete?: string;
  focusClassName?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-foreground">
        {label}
        {labelHi && <span className="ml-1.5 font-normal text-muted">{labelHi}</span>}
      </span>
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
