import { computed } from 'vue';
import { useThemeStore } from '@/stores/themeStore';
import type { StateTag } from '@/types/timeline';
import type { RenderStyle } from '@/types/timeline';

/**
 * 主题系统 Composable
 * 提供便捷的主题相关功能
 */
export function useTheme() {
  const themeStore = useThemeStore();

  // 当前主题相关
  const currentTheme = computed(() => themeStore.currentTheme);
  const currentThemeId = computed(() => themeStore.currentThemeId);
  const themeColors = computed(() => themeStore.colors);
  const themeStateStyles = computed(() => themeStore.stateStyles);
  const themeEffects = computed(() => themeStore.effects);
  const themeTypography = computed(() => themeStore.typography);
  const themeAnimation = computed(() => themeStore.animation);

  /**
   * 根据状态标签获取对应的渲染样式
   */
  function getStyleForState(stateTags: StateTag[], fallback?: RenderStyle): RenderStyle {
    return themeStore.stateStyles[stateTags[0]] || fallback || getBaseStyle();
  }

  /**
   * 获取基础样式
   */
  function getBaseStyle(): RenderStyle {
    return {
      fill: themeColors.value.primary,
      stroke: themeColors.value.textSecondary,
      text: themeColors.value.text,
      glow: 0,
    };
  }

  /**
   * 获取背景颜色
   */
  function getBackgroundColor(): string {
    return themeColors.value.background;
  }

  /**
   * 获取网格颜色
   */
  function getGridColor(): string {
    return themeColors.value.grid;
  }

  /**
   * 获取基线颜色
   */
  function getBaselineColor(): string {
    return themeColors.value.baseline;
  }

  /**
   * 应用主题到Canvas上下文
   */
  function applyThemeToCanvas(ctx: CanvasRenderingContext2D) {
    // 设置默认字体
    ctx.font = themeTypography.value.labelFont;

    // 设置阴影效果
    if (themeEffects.value.baselineGlow) {
      ctx.shadowBlur = themeEffects.value.shadowBlur;
    }
  }

  /**
   * 切换主题
   */
  function switchTheme(themeId: typeof currentThemeId.value) {
    themeStore.setTheme(themeId);
  }

  /**
   * 切换深色/浅色模式
   */
  function toggleDarkMode() {
    themeStore.toggleDarkMode();
  }

  /**
   * 下一个主题
   */
  function nextTheme() {
    themeStore.nextTheme();
  }

  /**
   * 上一个主题
   */
  function previousTheme() {
    themeStore.previousTheme();
  }

  /**
   * 判断当前是否为深色主题
   */
  const isDarkTheme = computed(() => {
    return ['dark', 'cyberpunk', 'ocean', 'sunset', 'forest'].includes(currentThemeId.value);
  });

  /**
   * 获取主题对比度适配颜色
   */
  function getContrastColor(bgColor?: string): string {
    const background = bgColor || themeColors.value.background;
    // 简单的亮度计算
    const hex = background.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;

    return brightness > 128 ? '#000000' : '#ffffff';
  }

  return {
    // 状态
    currentTheme,
    currentThemeId,
    themeColors,
    themeStateStyles,
    themeEffects,
    themeTypography,
    themeAnimation,
    isDarkTheme,

    // 方法
    getStyleForState,
    getBaseStyle,
    getBackgroundColor,
    getGridColor,
    getBaselineColor,
    applyThemeToCanvas,
    switchTheme,
    toggleDarkMode,
    nextTheme,
    previousTheme,
    getContrastColor,
  };
}