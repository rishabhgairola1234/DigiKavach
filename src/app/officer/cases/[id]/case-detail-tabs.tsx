"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { BilingualInline } from "@/components/bilingual";

// Lets a panel embedded in one of these tabs (e.g. CameraIntelligencePanel)
// know whether its own tab is the one currently showing, even though the
// panel itself is built server-side as part of a tab's static `content` and
// has no other way to hear about client-side tab switches. Value is the
// active tab's id, or null outside of any CaseDetailTabs.
const ActiveCaseTabContext = createContext<string | null>(null);

/**
 * True when `tabId` is the active tab, or when there's no CaseDetailTabs in
 * the tree at all (context absent, e.g. the component is used on a
 * non-tabbed page) -- so a panel using this hook stays fully live outside a
 * tabbed layout instead of defaulting to "paused". Pass no `tabId` for the
 * same always-active behavior from inside a tabbed page too.
 */
export function useIsCaseTabActive(tabId?: string): boolean {
  const activeId = useContext(ActiveCaseTabContext);
  if (tabId === undefined || activeId === null) return true;
  return activeId === tabId;
}

export type CaseDetailTab = {
  id: string;
  en: string;
  hi: string;
  // A pre-rendered icon element (e.g. <Paperclip className="h-4 w-4" />),
  // not a component reference -- this crosses the server/client boundary as
  // a plain React element, whereas passing the component type itself (a
  // function) from a Server Component to a Client Component isn't allowed.
  icon: ReactNode;
  content: ReactNode;
};

/**
 * All tab panels stay mounted the whole time -- only visibility toggles via
 * the "hidden" utility class -- so switching tabs never loses a panel's own
 * state (a generated FIR draft, an open Copilot conversation, an active
 * camera stream). Toggling display:none and back is also what naturally
 * replays the .pop-in entrance animation each time a tab becomes visible
 * again, with no extra JS needed for that.
 */
export function CaseDetailTabs({ tabs }: { tabs: CaseDetailTab[] }) {
  const [activeId, setActiveId] = useState(tabs[0]?.id);

  return (
    <div className="mt-8">
      <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-background p-1">
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveId(tab.id)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-all active:scale-[0.98] ${
                isActive
                  ? "bg-accent text-white"
                  : "text-muted hover:bg-background-elevated hover:text-foreground"
              }`}
            >
              {tab.icon}
              <BilingualInline en={tab.en} hi={tab.hi} />
            </button>
          );
        })}
      </div>

      <ActiveCaseTabContext.Provider value={activeId ?? null}>
        {tabs.map((tab) => (
          <div key={tab.id} className={tab.id === activeId ? "pop-in mt-6" : "hidden"}>
            {tab.content}
          </div>
        ))}
      </ActiveCaseTabContext.Provider>
    </div>
  );
}
