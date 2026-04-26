import type { RenderStyle, StateTag } from "@/types/timeline";

const TAG_STYLE_MAP: Record<StateTag, RenderStyle> = {
  comparing: { fill: "#ffcc00", glow: 0.6 },
  swapping: { fill: "#ff6b6b", glow: 0.6 },
  sorted: { fill: "#67c23a", glow: 0.3 },
  pivot: { fill: "#9b59b6", glow: 0.8 },
  pending: { fill: "#9575cd", glow: 0.25 },
  latest: { fill: "#4ecdc4", glow: 0.45 },
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
    alpha: (from.alpha ?? 1) + ((to.alpha ?? 1) - (from.alpha ?? 1)) * progress,
  };
}
