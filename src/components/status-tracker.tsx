import { Check } from "lucide-react";
import { COMPLAINT_STATUS_LABEL_HI, type ComplaintStatus } from "@/lib/complaints";

// Maps every status onto one of 4 visual step positions. "closed" shares the
// final slot with "resolved" -- it's an end state reached from anywhere, not
// a 5th sequential stage -- but gets its own label and a neutral (not green)
// color, since being closed isn't necessarily a positive outcome.
function stepIndexForStatus(status: ComplaintStatus): number {
  switch (status) {
    case "filed":
      return 0;
    case "under_review":
      return 1;
    case "investigating":
      return 2;
    case "resolved":
    case "closed":
      return 3;
  }
}

export function StatusTracker({ status }: { status: ComplaintStatus }) {
  const currentIndex = stepIndexForStatus(status);
  const isClosed = status === "closed";
  const labels = ["Filed", "Under Review", "Investigating", isClosed ? "Closed" : "Resolved"];
  const hiLabels = [
    COMPLAINT_STATUS_LABEL_HI.filed,
    COMPLAINT_STATUS_LABEL_HI.under_review,
    COMPLAINT_STATUS_LABEL_HI.investigating,
    isClosed ? COMPLAINT_STATUS_LABEL_HI.closed : COMPLAINT_STATUS_LABEL_HI.resolved,
  ];

  return (
    <div className="w-full">
      <div className="grid grid-cols-4 items-center">
        {labels.map((label, i) => {
          const completed = i < currentIndex;
          const isTerminal = i === labels.length - 1;
          const isCurrent = i === currentIndex;
          const reached = completed || (isCurrent && isTerminal);

          let circleClasses = "border-border bg-background text-muted"; // future
          if (completed) {
            circleClasses = "border-warm-accent bg-warm-accent text-white";
          } else if (isCurrent) {
            circleClasses = isTerminal
              ? isClosed
                ? "border-muted bg-muted/40 text-foreground"
                : "border-priority-low bg-priority-low text-white"
              : "border-warm-accent bg-warm-accent/20 text-warm-accent";
          }

          return (
            <div key={label} className="flex items-center">
              <div
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${circleClasses}`}
              >
                {reached ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <span className="text-[9px] font-semibold">{i + 1}</span>
                )}
              </div>
              {i < labels.length - 1 && (
                <div
                  className={`h-0.5 flex-1 rounded-full transition-colors ${
                    i < currentIndex ? "bg-warm-accent" : "bg-border"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-1 grid grid-cols-4">
        {labels.map((label, i) => (
          <span key={label} className="flex flex-col truncate">
            <span
              className={`truncate text-[9px] font-medium uppercase tracking-wide ${
                i <= currentIndex ? "text-foreground" : "text-muted"
              }`}
            >
              {label}
            </span>
            <span className="truncate text-[8px] text-muted">{hiLabels[i]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
