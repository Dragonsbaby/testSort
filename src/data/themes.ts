import type { ThemeDefinition, ThemeId } from "@/types/theme";

/** 主题切换混合时长（ms），与 CSS 过渡时长保持一致 */
export const THEME_MIX_DURATION = 300;

/**
 * 精品主题库：一套设计语言，明暗两个变体。
 * 字体栈只允许自托管或系统字体（Orbitron 教训，见 spec 6.4）。
 */
export const THEME_PRESETS: { default: ThemeId; themes: ThemeDefinition[] } = {
  default: "dark",
  themes: [
    {
      id: "dark",
      name: "画廊",
      dark: true,
      ui: {
        bg1: "#0b0e14",
        bg2: "#11151d",
        bg3: "#171c26",
        border: "rgba(255, 255, 255, 0.08)",
        text: "#e8ecf3",
        textSecondary: "#9aa4b5",
        textMuted: "#5c6675",
        accent: "#89b4fa",
        shadow: "none",
      },
      canvas: {
        background: "#0b0e14",
        backgroundSecondary: "#11151d",
        text: "#9aa4b5",
        indexText: "#5c6675",
        shadowBlur: 9,
        grid: "rgba(255, 255, 255, 0.045)",
        gridSpacing: 24,
        baseline: "rgba(255, 255, 255, 0.14)",
        states: {
          pending: { fill: "#3d4f66", glow: 0 },
          "heap-pending": { fill: "#2b3a52", glow: 0 },
          comparing: { fill: "#f5c542", glow: 0.8 },
          swapping: { fill: "#ff5d5d", glow: 1 },
          sorted: { fill: "#3ecf8e", glow: 0 },
          pivot: { fill: "#b78cff", glow: 0.7 },
          latest: { fill: "#22d3ee", glow: 0 },
        },
        accent: "#89b4fa",
        uiText: "#e8ecf3",
        uiTextSecondary: "#9aa4b5",
        uiTextMuted: "#5c6675",
        border: "rgba(255, 255, 255, 0.08)",
      },
    },
    {
      id: "light",
      name: "画室",
      dark: false,
      ui: {
        bg1: "#fafaf7",
        bg2: "#ffffff",
        bg3: "#ffffff",
        border: "#e4e2da",
        text: "#1c1e24",
        textSecondary: "#5a5f6b",
        textMuted: "#9aa0ab",
        accent: "#3b6fd4",
        shadow: "0 1px 3px rgba(28, 30, 36, 0.08)",
      },
      canvas: {
        background: "#fafaf7",
        backgroundSecondary: "#f2f1ec",
        text: "#5a5f6b",
        indexText: "#9aa0ab",
        shadowBlur: 0,
        grid: "rgba(28, 30, 36, 0.05)",
        gridSpacing: 24,
        baseline: "rgba(28, 30, 36, 0.25)",
        states: {
          pending: { fill: "#a8b3c4", glow: 0 },
          "heap-pending": { fill: "#94a1b5", glow: 0 },
          comparing: { fill: "#d97706", glow: 0 },
          swapping: { fill: "#dc2626", glow: 0 },
          sorted: { fill: "#059669", glow: 0 },
          pivot: { fill: "#7c3aed", glow: 0 },
          latest: { fill: "#0891b2", glow: 0 },
        },
        accent: "#3b6fd4",
        uiText: "#1c1e24",
        uiTextSecondary: "#5a5f6b",
        uiTextMuted: "#9aa0ab",
        border: "#e4e2da",
      },
    },
  ],
};

/** 旧主题 ID → 新主题 ID 的一次性映射（spec 5.4 迁移表） */
const LEGACY_THEME_MAP: Record<string, ThemeId> = {
  dark: "dark",
  cyberpunk: "dark",
  ocean: "dark",
  sunset: "dark",
  forest: "dark",
  light: "light",
};

/**
 * localStorage 存量主题 ID 迁移；返回 null 表示无存量或未知值（由调用方走系统偏好检测）
 */
export function migrateThemeId(saved: string | null): ThemeId | null {
  if (!saved) return null;
  if (saved === "dark" || saved === "light") return saved;
  return LEGACY_THEME_MAP[saved] ?? null;
}
