import type { RenderStyle, StateTag } from "@/types/timeline";

export const BAR_BASE_STYLE: RenderStyle = {
  fill: "#4a9eff",
  stroke: "rgba(126, 214, 255, 0.52)",
  text: "#ffd43b",
  glow: 0,
};

const TAG_STYLE_MAP: Record<StateTag, RenderStyle> = {
  comparing: { fill: "#ffcc00", stroke: "rgba(255, 230, 102, 0.9)", text: "#ffd43b", glow: 0.72 },
  swapping: { fill: "#ff5c5c", stroke: "rgba(255, 132, 132, 0.95)", text: "#ffd43b", glow: 0.82 },
  sorted: { fill: "#33d17a", stroke: "rgba(103, 226, 151, 0.86)", text: "#ffd43b", glow: 0.42 },
  pivot: { fill: "#b979ff", stroke: "rgba(210, 164, 255, 0.8)", text: "#ffd43b", glow: 0.58 },
  pending: { fill: "#00c8d4", stroke: "rgba(160, 190, 255, 0.78)", text: "#ffd43b", glow: 0.48 },
  "heap-pending": { fill: "#2e5490", stroke: "rgba(90, 140, 210, 0.7)", text: "#b8d0f0", glow: 0.15 },
  latest: { fill: "#4ecdc4", stroke: "rgba(124, 241, 232, 0.78)", text: "#ffd43b", glow: 0.48 },
};

export function getStyleFromStateTags(stateTags: StateTag[], fallback: RenderStyle): RenderStyle {
  for (const tag of stateTags) {
    if (TAG_STYLE_MAP[tag]) {
      return { ...fallback, ...TAG_STYLE_MAP[tag] };
    }
  }

  return fallback;
}

export function interpolateStyle(from: RenderStyle, to: RenderStyle, progress: number): RenderStyle {
  return {
    fill: progress < 0.5 ? from.fill : to.fill,
    stroke: progress < 0.5 ? from.stroke : to.stroke,
    text: progress < 0.5 ? from.text : to.text,
    glow: (from.glow ?? 0) + ((to.glow ?? 0) - (from.glow ?? 0)) * progress,
    dashed: progress < 0.5 ? from.dashed : to.dashed,
    alpha: (from.alpha !== undefined || to.alpha !== undefined)
      ? (from.alpha ?? 1) + ((to.alpha ?? 1) - (from.alpha ?? 1)) * progress
      : undefined,
  };
}
