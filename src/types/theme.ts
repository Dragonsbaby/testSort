import type { StateTag } from "./timeline";

/** 主题标识符（双城：暗画廊 / 亮画室） */
export type ThemeId = "dark" | "light";

/** 单个状态的视觉：填充色 + 发光乘数（0~1，由 renderer 乘 shadowBlur 基数） */
export interface StateVisual {
  fill: string;
  glow: number;
}

/**
 * 渲染期调色板：useCanvasRenderer 每帧读取的唯一取色来源。
 * 由主题 canvas 段 + overlay 需要的 ui 子集合成；主题切换时 300ms 逐字段混合。
 * grid / gridSpacing / baseline / border 可能是 rgba() 字符串，不参与混合（直接取新主题）。
 */
export interface RendererPalette {
  /** 背景色（混合） */
  background: string;
  /** 次级背景 / badge 底色（混合） */
  backgroundSecondary: string;
  /** Canvas 内数值文字色（混合） */
  text: string;
  /** Canvas 内序号文字色（混合） */
  indexText: string;
  /** 发光基数，最终 shadowBlur = shadowBlur * state.glow（数值混合） */
  shadowBlur: number;
  /** 点阵圆点色（不混合，rgba 字符串） */
  grid: string;
  /** 点阵间距 px（不混合） */
  gridSpacing: number;
  /** 基线色（不混合，rgba 字符串） */
  baseline: string;
  /** 状态色板（fill 混合、glow 数值混合） */
  states: Record<StateTag, StateVisual>;
  /** —— 以下为 overlay 需要的 ui 子集（混合） —— */
  accent: string;
  uiText: string;
  uiTextSecondary: string;
  uiTextMuted: string;
  /** 面板/分隔线边框色（不混合，可能 rgba） */
  border: string;
}

/** UI 层 token（注入为 CSS 变量） */
export interface ThemeUiTokens {
  bg1: string;
  bg2: string;
  bg3: string;
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  /** 面板投影；暗色为 "none"（用边框分层），亮色用极轻投影 */
  shadow: string;
}

/** 主题定义（纯数据，三段结构） */
export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  /** 元数据：深浅判断唯一来源，消灭硬编码主题 ID 列表 */
  dark: boolean;
  ui: ThemeUiTokens;
  /** Canvas 渲染段：直接复用 RendererPalette 字段集 */
  canvas: RendererPalette;
}
