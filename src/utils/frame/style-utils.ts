import type { RenderStyle, StateTag } from "@/types/timeline";
import type { RendererPalette } from "@/types/theme";

/** 渲染期实体样式：填充色 + 发光乘数（最终 shadowBlur = palette.shadowBlur * glow） */
export interface ResolvedEntityStyle {
  fill: string;
  glow: number;
}

/**
 * 渲染期取色（spec 5.1）：按 tags 传入顺序取首个命中状态。
 * 空 tags / 全部未命中时回退 pending（画廊基底占约 80% 柱子）。
 * 颜色不再烘焙进 FrameState，切主题即时生效。
 */
export function resolveEntityStyle(stateTags: StateTag[], palette: RendererPalette): ResolvedEntityStyle {
  for (const tag of stateTags) {
    const visual = palette.states[tag];
    if (visual) return { fill: visual.fill, glow: visual.glow };
  }
  return { ...palette.states.pending };
}

/**
 * 非主题样式插值：dashed 在 progress<0.5 取 from（二值切换是有意设计，配合状态节奏）；
 * alpha 线性 lerp，且仅在 from/to 至少一方显式定义时才注入，
 * 避免默认 alpha=1 架空 opacity=0（CLAUDE.md 经验 #1 的关键防御）。
 */
export function interpolateStyle(from: RenderStyle, to: RenderStyle, progress: number): RenderStyle {
  return {
    dashed: progress < 0.5 ? from.dashed : to.dashed,
    alpha: (from.alpha !== undefined || to.alpha !== undefined)
      ? (from.alpha ?? 1) + ((to.alpha ?? 1) - (from.alpha ?? 1)) * progress
      : undefined,
  };
}
