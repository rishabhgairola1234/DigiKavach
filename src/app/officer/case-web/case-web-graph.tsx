"use client";

import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import type { ComplaintPriority } from "@/lib/complaints";
import { parseMatchedOn, encodeEntitySlug } from "@/lib/dossier";

// react-force-graph-2d is canvas-based and touches `window` at import time --
// same rule as leaflet in mini-map.tsx: `ssr: false` is what actually keeps
// it out of the server bundle, not just marking this file 'use client'.
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[600px] w-full items-center justify-center text-sm text-muted">
      Loading case web...
    </div>
  ),
});

export type CaseWebNode = {
  id: string;
  title: string;
  priority: ComplaintPriority | null;
};

export type CaseWebLink = {
  source: string;
  target: string;
  matchedOn: string;
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#22c55e",
  unclassified: "#94a3b8",
};

// Loosely typed on purpose -- react-force-graph-2d's generics don't survive
// being wrapped in next/dynamic (needed for ssr:false), so callback
// parameters come through as `any` regardless of what's declared here.
// Reading known fields off them directly is simpler and just as safe as
// fighting that with casts everywhere.
export function CaseWebGraph({
  nodes,
  links,
}: {
  nodes: CaseWebNode[];
  links: CaseWebLink[];
}) {
  const router = useRouter();

  return (
    <div className="h-[600px] w-full overflow-hidden rounded-xl border border-border bg-background">
      {/* eslint-disable @typescript-eslint/no-explicit-any */}
      <ForceGraph2D
        graphData={{ nodes: nodes as any, links: links as any }}
        backgroundColor="#0f172a"
        nodeId="id"
        nodeLabel={(node: any) => node.title}
        nodeRelSize={5}
        nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
          const color = PRIORITY_COLORS[node.priority ?? "unclassified"];
          const x = node.x ?? 0;
          const y = node.y ?? 0;

          ctx.beginPath();
          ctx.arc(x, y, 5, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.lineWidth = 1;
          ctx.strokeStyle = "#0f172a";
          ctx.stroke();

          const label: string =
            node.title.length > 26 ? `${node.title.slice(0, 26)}…` : node.title;
          const fontSize = 12 / globalScale;
          ctx.font = `${fontSize}px sans-serif`;
          ctx.fillStyle = "#e2e8f0";
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillText(label, x, y + 8);
        }}
        linkColor={(link: any) =>
          typeof link.matchedOn === "string" && link.matchedOn.startsWith("vehicle_plate")
            ? "#38bdf8"
            : "#f59e0b"
        }
        linkWidth={1.5}
        linkLabel={(link: any) => link.matchedOn}
        linkCanvasObject={(link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
          const source = link.source;
          const target = link.target;
          if (!source || typeof source !== "object" || !target || typeof target !== "object") {
            return;
          }

          const midX = (source.x + target.x) / 2;
          const midY = (source.y + target.y) / 2;
          const fontSize = 9 / globalScale;
          ctx.font = `${fontSize}px sans-serif`;
          ctx.fillStyle = "rgba(226, 232, 240, 0.85)";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(link.matchedOn, midX, midY);
        }}
        onNodeClick={(node: any) => router.push(`/officer/cases/${node.id}`)}
        onLinkClick={(link: any) => {
          const entity = parseMatchedOn(link.matchedOn);
          if (entity) router.push(`/officer/dossier/${encodeEntitySlug(entity)}`);
        }}
        enableNodeDrag
      />
      {/* eslint-enable @typescript-eslint/no-explicit-any */}
    </div>
  );
}
