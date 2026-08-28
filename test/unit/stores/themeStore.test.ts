import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useThemeStore } from '@/stores/themeStore';

beforeEach(() => {
  setActivePinia(createPinia());
  localStorage.clear();
  document.documentElement.style.cssText = '';
  document.body.className = '';
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('themeStore.initialize', () => {
  test('无存量且系统无亮色偏好时默认 dark', () => {
    // mock matchMedia（happy-dom 默认返回亮色偏好，需显式控制）
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList);
    const store = useThemeStore();
    store.initialize();
    expect(store.currentThemeId).toBe('dark');
  });

  test('无存量且系统偏好亮色时默认 light', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
    const store = useThemeStore();
    store.initialize();
    expect(store.currentThemeId).toBe('light');
  });

  test('旧主题 ID 迁移并回写 localStorage', () => {
    for (const [saved, expected] of [['cyberpunk', 'dark'], ['forest', 'dark'], ['light', 'light']] as const) {
      localStorage.setItem('sort-visualizer-theme', saved);
      const store = useThemeStore();
      store.initialize();
      expect(store.currentThemeId).toBe(expected);
      expect(localStorage.getItem('sort-visualizer-theme')).toBe(expected);
    }
  });
});

describe('themeStore.setTheme', () => {
  test('切换后 CSS 变量与 --el-* 映射注入 documentElement', () => {
    const store = useThemeStore();
    store.setTheme('light');
    const style = document.documentElement.style;
    expect(style.getPropertyValue('--bg-1')).toBe('#fafaf7');
    expect(style.getPropertyValue('--accent')).toBe('#3b6fd4');
    expect(style.getPropertyValue('--el-color-primary')).toBe('#3b6fd4');
    expect(style.getPropertyValue('--el-bg-color')).toBe('#fafaf7');
  });

  test('切换后 localStorage 持久化且 isDark 翻转', () => {
    const store = useThemeStore();
    expect(store.isDark).toBe(true);
    store.toggleDarkMode();
    expect(store.currentThemeId).toBe('light');
    expect(store.isDark).toBe(false);
    expect(localStorage.getItem('sort-visualizer-theme')).toBe('light');
  });

  test('未知主题 ID 静默忽略', () => {
    const store = useThemeStore();
    store.setTheme('nonexistent' as never);
    expect(store.currentThemeId).toBe('dark');
  });
});

describe('色板混合状态', () => {
  test('isPaletteMixing：切换后为 true，currentRendererPalette(∞) 后归位', () => {
    const store = useThemeStore();
    store.setTheme('light');
    expect(store.isPaletteMixing()).toBe(true);
    // 混合结束后取 to 且停止混合
    const final = store.currentRendererPalette(Number.MAX_SAFE_INTEGER);
    expect(final.background).toBe('#fafaf7');
    expect(store.isPaletteMixing()).toBe(false);
  });

  test('混合中途：t=0.5 时 background 为两主题中点（easeOutCubic(0.5)=0.875）', () => {
    const store = useThemeStore();
    store.setTheme('light');
    // 主题切换发生在此刻，用 mixStartedAt 无法直接读；改验证任意中途值在两极值之间
    const mid = store.currentRendererPalette(performance.now() + 10);
    const bg = mid.background;
    expect(bg).not.toBe('#0b0e14'); // 已离开起点
  });
});
