import { defineStore } from "pinia";
import { ref, computed, watch } from "vue";
import type { RendererPalette, ThemeId } from "@/types/theme";
import { THEME_PRESETS, migrateThemeId, THEME_MIX_DURATION } from "@/data/themes";
import { mixRendererPalette, easeOutCubic } from "@/utils/frame/palette-mixer";

const THEME_STORAGE_KEY = "sort-visualizer-theme";

/** 主题库（纯静态数据，无需响应式包装） */
const THEMES = THEME_PRESETS.themes;

/**
 * 主题管理 Store（双城：dark / light）
 * - UI 层：CSS 变量注入（含 --el-* 防御性映射）
 * - Canvas 层：渲染期调色板 + 300ms 混合换装
 */
export const useThemeStore = defineStore("theme", () => {
  const currentThemeId = ref<ThemeId>("dark");

  const currentTheme = computed(
    () => THEMES.find((t) => t.id === currentThemeId.value) ?? THEMES[0],
  );
  const isDark = computed(() => currentTheme.value.dark);

  // ── 渲染调色板混合状态（非响应式：由 renderer 每帧轮询，避免高频 ref 触发） ──
  let paletteFrom: RendererPalette = currentTheme.value.canvas;
  let paletteTo: RendererPalette = paletteFrom;
  let mixStartedAt = 0; // 0 = 无进行中的混合

  /** 混合是否进行中（renderer 据此决定是否继续请求下一帧） */
  function isPaletteMixing(): boolean {
    return mixStartedAt !== 0;
  }

  /** 当前时刻的渲染调色板；renderer 每帧调用（非响应式读取） */
  function currentRendererPalette(now: number): RendererPalette {
    if (mixStartedAt === 0) return paletteTo;
    const raw = Math.min(1, (now - mixStartedAt) / THEME_MIX_DURATION);
    if (raw >= 1) {
      mixStartedAt = 0;
      paletteFrom = paletteTo;
      return paletteTo;
    }
    return mixRendererPalette(paletteFrom, paletteTo, easeOutCubic(raw));
  }

  /** 渲染调色板直接就位到当前主题（初始化用，不做混合动画） */
  function syncPaletteToCurrentTheme() {
    paletteFrom = paletteTo = currentTheme.value.canvas;
    mixStartedAt = 0;
  }

  /** 初始化：localStorage 迁移 → 系统偏好 → 默认 dark */
  function initialize() {
    const migrated = migrateThemeId(localStorage.getItem(THEME_STORAGE_KEY));
    if (migrated) {
      currentThemeId.value = migrated;
      localStorage.setItem(THEME_STORAGE_KEY, migrated);
      syncPaletteToCurrentTheme();
      return;
    }
    if (window.matchMedia?.("(prefers-color-scheme: light)").matches) {
      currentThemeId.value = "light";
      syncPaletteToCurrentTheme();
    }
  }

  /** 切换主题：从当前视觉状态继续混合到新主题（spec 5.3） */
  function setTheme(themeId: ThemeId) {
    const next = THEMES.find((t) => t.id === themeId);
    if (!next || themeId === currentThemeId.value) return;

    // 若上一轮混合未结束，从当前混合值继续，避免跳变
    paletteFrom = currentRendererPalette(performance.now());
    paletteTo = next.canvas;
    mixStartedAt = performance.now();

    currentThemeId.value = themeId;
    localStorage.setItem(THEME_STORAGE_KEY, themeId);
  }

  /** 深浅切换（dark 元数据驱动，无硬编码 ID 列表） */
  function toggleDarkMode() {
    setTheme(isDark.value ? "light" : "dark");
  }

  /** 注入 UI token CSS 变量 + --el-* 防御性映射（EP 组件当前零使用，映射为未来引入时自动同源） */
  function applyThemeToDOM() {
    const ui = currentTheme.value.ui;
    const vars: Record<string, string> = {
      "--bg-1": ui.bg1,
      "--bg-2": ui.bg2,
      "--bg-3": ui.bg3,
      "--border": ui.border,
      "--text": ui.text,
      "--text-secondary": ui.textSecondary,
      "--text-muted": ui.textMuted,
      "--accent": ui.accent,
      "--panel-shadow": ui.shadow,
      // Canvas 点阵（App.vue 背景与 Canvas gridSpacing 24 对齐）
      "--canvas-grid": currentTheme.value.canvas.grid,
      // 状态语义色（UI 徽标用，与 Canvas 状态色同源）
      "--sorted": currentTheme.value.canvas.states.sorted.fill,
      "--swapping": currentTheme.value.canvas.states.swapping.fill,
      // Element Plus 映射层
      "--el-color-primary": ui.accent,
      "--el-bg-color": ui.bg1,
      "--el-bg-color-overlay": ui.bg3,
      "--el-text-color-primary": ui.text,
      "--el-text-color-regular": ui.textSecondary,
      "--el-text-color-secondary": ui.textMuted,
      "--el-border-color": ui.border,
      "--el-border-color-light": ui.border,
      "--el-border-color-lighter": ui.border,
      "--el-fill-color-blank": ui.bg2,
      "--el-fill-color-light": ui.bg3,
    };
    const root = document.documentElement;
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value);
    }
    document.body.className = `theme-${currentThemeId.value}`;
  }

  // sync flush：id 变更与 CSS 变量注入原子生效（切换是低频用户操作，同步无性能顾虑）
  watch(currentThemeId, applyThemeToDOM, { immediate: true, flush: "sync" });

  return {
    currentThemeId,
    isDark,
    initialize,
    setTheme,
    toggleDarkMode,
    currentRendererPalette,
    isPaletteMixing,
  };
});
