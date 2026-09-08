import {
  Briefcase,
  Siren,
  ArrowUpCircle,
  CircleDot,
  CircleMinus,
  Hourglass,
  AlarmClock,
} from "lucide-react";
import { Bilingual } from "@/components/bilingual";

export type DashboardStats = {
  total: number;
  activeSos: number;
  highPriority: number;
  mediumPriority: number;
  lowPriority: number;
  awaitingAction: number;
  overdue: number;
};

export function StatsRow({ stats }: { stats: DashboardStats }) {
  const cards = [
    {
      label: "Total Cases",
      labelHi: "कुल मामले",
      value: stats.total,
      icon: Briefcase,
      tone: "text-accent-strong bg-accent-soft",
    },
    {
      label: "Active SOS",
      labelHi: "सक्रिय एसओएस",
      value: stats.activeSos,
      icon: Siren,
      tone: "text-priority-high bg-priority-high/15",
    },
    {
      label: "High Priority",
      labelHi: "उच्च प्राथमिकता",
      value: stats.highPriority,
      icon: ArrowUpCircle,
      tone: "text-priority-high bg-priority-high/15",
    },
    {
      label: "Medium Priority",
      labelHi: "मध्यम प्राथमिकता",
      value: stats.mediumPriority,
      icon: CircleDot,
      tone: "text-priority-medium bg-priority-medium/15",
    },
    {
      label: "Low Priority",
      labelHi: "निम्न प्राथमिकता",
      value: stats.lowPriority,
      icon: CircleMinus,
      tone: "text-priority-low bg-priority-low/15",
    },
    {
      label: "Awaiting Action",
      labelHi: "कार्रवाई लंबित",
      value: stats.awaitingAction,
      icon: Hourglass,
      tone: "text-muted bg-muted/15",
    },
    {
      label: "Overdue",
      labelHi: "समय-सीमा पार",
      value: stats.overdue,
      icon: AlarmClock,
      tone: "text-priority-medium bg-priority-medium/15",
    },
  ];

  return (
    <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-border bg-background-elevated p-4"
        >
          <div
            className={`mb-2 inline-flex h-7 w-7 items-center justify-center rounded-lg ${card.tone}`}
          >
            <card.icon className="h-4 w-4" />
          </div>
          <p className="text-xl font-semibold text-foreground">{card.value}</p>
          <Bilingual
            as="p"
            en={card.label}
            hi={card.labelHi}
            className="leading-snug text-xs text-muted"
            hiClassName="block text-[10px] leading-snug text-muted/80"
          />
        </div>
      ))}
    </div>
  );
}
