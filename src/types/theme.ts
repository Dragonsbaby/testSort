import type { RenderStyle } from "./timeline";

/**
 * 主题标识符
 */
export type ThemeId = "dark" | "light" | "cyberpunk" | "ocean" | "sunset" | "forest";

/**
 * 颜色调色板
 */
export interface ColorPalette {
  // 背景颜色
  background: string;
  backgroundSecondary?: string;

  // 网格和辅助线
  grid: string;
  baseline: string;
  divider?: string;

  // 文字颜色
  text: string;
  textSecondary: string;
  textMuted: string;

  // 实体基础颜色
  primary: string;
  secondary?: string;
}

/**
 * 状态样式映射
 */
export interface StateStyleMapping {
  [key: string]: RenderStyle;
}

/**
 * 主题配置
 */
export interface Theme {
  id: ThemeId;
  name: string;
  description: string;

  // 颜色调色板
  colors: ColorPalette;

  // 状态标签样式映射
  stateStyles: StateStyleMapping;

  // 视觉效果配置
  effects: {
    gridSpacing: number;
    gridOpacity: number;
    baselineGlow: boolean;
    baselineOpacity: number;
    shadowBlur: number;
    particleEffect?: boolean; // 粒子效果
  };

  // 字体配置
  typography: {
    labelFont: string;
    valueFont: string;
    monospaceFont: string;
  };

  // 动画配置
  animation: {
    easing: string;
    transitionSpeed: number;
  };
}

/**
 * 主题预设配置
 */
export interface ThemePreset {
  themes: Theme[];
  default: ThemeId;
}