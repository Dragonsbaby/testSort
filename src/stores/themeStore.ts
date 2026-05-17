import { defineStore } from "pinia";
import { ref, computed, watch } from "vue";
import type { ThemeId } from "@/types/theme";
import { THEME_PRESETS } from "@/data/themes";

const THEME_STORAGE_KEY = "sort-visualizer-theme";

/**
 * 主题管理Store
 */
export const useThemeStore = defineStore("theme", () => {
  // 状态
  const currentThemeId = ref<ThemeId>("dark");
  const isTransitioning = ref(false);

  // 获取所有可用主题
  const availableThemes = computed(() => THEME_PRESETS.themes);

  // 当前主题对象
  const currentTheme = computed(() => {
    return (
      availableThemes.value.find((t) => t.id === currentThemeId.value) ||
      availableThemes.value[0]
    );
  });

  // 主题颜色快捷访问
  const colors = computed(() => currentTheme.value.colors);

  // 状态样式快捷访问
  const stateStyles = computed(() => currentTheme.value.stateStyles);

  // 效果配置快捷访问
  const effects = computed(() => currentTheme.value.effects);

  // 字体配置快捷访问
  const typography = computed(() => currentTheme.value.typography);

  // 动画配置快捷访问
  const animation = computed(() => currentTheme.value.animation);

  // 初始化：从localStorage读取用户主题偏好
  function initialize() {
    const savedThemeId = localStorage.getItem(THEME_STORAGE_KEY) as ThemeId;
    if (savedThemeId && isValidThemeId(savedThemeId)) {
      currentThemeId.value = savedThemeId;
    } else {
      // 检测系统主题偏好
      if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
        currentThemeId.value = "light";
      }
    }
  }

  // 验证主题ID是否有效
  function isValidThemeId(id: string): id is ThemeId {
    return availableThemes.value.some((t) => t.id === id);
  }

  // 切换主题
  function setTheme(themeId: ThemeId, withTransition = true) {
    if (!isValidThemeId(themeId)) {
      console.warn(`Invalid theme ID: ${themeId}`);
      return;
    }

    if (withTransition) {
      isTransitioning.value = true;
      // 添加CSS过渡类
      document.body.classList.add("theme-transitioning");

      setTimeout(() => {
        currentThemeId.value = themeId;
        localStorage.setItem(THEME_STORAGE_KEY, themeId);

        // 移除过渡类
        setTimeout(() => {
          document.body.classList.remove("theme-transitioning");
          isTransitioning.value = false;
        }, 300);
      }, 50);
    } else {
      currentThemeId.value = themeId;
      localStorage.setItem(THEME_STORAGE_KEY, themeId);
    }
  }

  // 切换到下一个主题
  function nextTheme() {
    const currentIndex = availableThemes.value.findIndex((t) => t.id === currentThemeId.value);
    const nextIndex = (currentIndex + 1) % availableThemes.value.length;
    setTheme(availableThemes.value[nextIndex].id);
  }

  // 切换到上一个主题
  function previousTheme() {
    const currentIndex = availableThemes.value.findIndex((t) => t.id === currentThemeId.value);
    const prevIndex = (currentIndex - 1 + availableThemes.value.length) % availableThemes.value.length;
    setTheme(availableThemes.value[prevIndex].id);
  }

  // 切换深色/浅色模式
  function toggleDarkMode() {
    const isDark = currentThemeId.value === "dark" ||
                   currentThemeId.value === "cyberpunk" ||
                   currentThemeId.value === "ocean" ||
                   currentThemeId.value === "sunset" ||
                   currentThemeId.value === "forest";

    setTheme(isDark ? "light" : "dark");
  }

  // 获取主题样式对象（用于CSS变量）
  function getThemeCSSVariables() {
    return {
      "--color-background": currentTheme.value.colors.background,
      "--color-background-secondary": currentTheme.value.colors.backgroundSecondary || currentTheme.value.colors.background,
      "--color-grid": currentTheme.value.colors.grid,
      "--color-baseline": currentTheme.value.colors.baseline,
      "--color-text": currentTheme.value.colors.text,
      "--color-text-secondary": currentTheme.value.colors.textSecondary,
      "--color-text-muted": currentTheme.value.colors.textMuted,
      "--color-primary": currentTheme.value.colors.primary,
    };
  }

  // 应用主题到DOM
  function applyThemeToDOM() {
    const root = document.documentElement;
    const cssVars = getThemeCSSVariables();

    Object.entries(cssVars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    // 设置主题类名
    document.body.className = `theme-${currentThemeId.value}`;
  }

  // 监听主题变化，自动应用到DOM
  watch(currentThemeId, () => {
    applyThemeToDOM();
  }, { immediate: true });

  // 导出主题配置（用于分享）
  function exportThemeConfig() {
    return {
      themeId: currentThemeId.value,
      timestamp: Date.now(),
    };
  }

  // 导入主题配置
  function importThemeConfig(config: { themeId: ThemeId; timestamp: number }) {
    if (isValidThemeId(config.themeId)) {
      setTheme(config.themeId);
    }
  }

  // 重置为默认主题
  function resetToDefault() {
    setTheme(THEME_PRESETS.default);
  }

  return {
    // 状态
    currentThemeId,
    currentTheme,
    isTransitioning,
    availableThemes,

    // 计算属性
    colors,
    stateStyles,
    effects,
    typography,
    animation,

    // 方法
    initialize,
    setTheme,
    nextTheme,
    previousTheme,
    toggleDarkMode,
    getThemeCSSVariables,
    applyThemeToDOM,
    exportThemeConfig,
    importThemeConfig,
    resetToDefault,
  };
});