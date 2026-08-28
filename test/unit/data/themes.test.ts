import { describe, test, expect } from 'vitest';
import { THEME_PRESETS, migrateThemeId } from '@/data/themes';
import type { StateTag } from '@/types/timeline';

const ALL_TAGS: StateTag[] = ['comparing', 'swapping', 'sorted', 'pivot', 'pending', 'heap-pending', 'latest'];

describe('THEME_PRESETS', () => {
  test('默认主题是 dark', () => {
    expect(THEME_PRESETS.default).toBe('dark');
  });

  test('恰好两个主题：dark 与 light', () => {
    expect(THEME_PRESETS.themes.map(t => t.id)).toEqual(['dark', 'light']);
  });

  test('每个主题 dark 元数据与 id 一致（消灭硬编码 ID 列表）', () => {
    for (const theme of THEME_PRESETS.themes) {
      expect(theme.dark).toBe(theme.id === 'dark');
    }
  });

  test('每个主题 canvas.states 覆盖全部 7 个 StateTag 且 fill 为 6 位 hex', () => {
    for (const theme of THEME_PRESETS.themes) {
      for (const tag of ALL_TAGS) {
        const visual = theme.canvas.states[tag];
        expect(visual, `${theme.id} 缺少状态 ${tag}`).toBeDefined();
        expect(visual.fill).toMatch(/^#[0-9a-f]{6}$/i);
        expect(visual.glow).toBeGreaterThanOrEqual(0);
        expect(visual.glow).toBeLessThanOrEqual(1);
      }
    }
  });

  test('暗色主题仅 comparing/swapping/pivot 发光（射灯原则）', () => {
    const dark = THEME_PRESETS.themes.find(t => t.id === 'dark')!;
    expect(dark.canvas.states.comparing.glow).toBeGreaterThan(0);
    expect(dark.canvas.states.swapping.glow).toBeGreaterThan(0);
    expect(dark.canvas.states.pivot.glow).toBeGreaterThan(0);
    expect(dark.canvas.states.sorted.glow).toBe(0);
    expect(dark.canvas.states.pending.glow).toBe(0);
    expect(dark.canvas.states.latest.glow).toBe(0);
    expect(dark.canvas.states['heap-pending'].glow).toBe(0);
  });

  test('亮色主题零发光', () => {
    const light = THEME_PRESETS.themes.find(t => t.id === 'light')!;
    expect(light.canvas.shadowBlur).toBe(0);
  });

  test('两主题 gridSpacing 一致为 24（Canvas 与 CSS 点阵对齐）', () => {
    for (const theme of THEME_PRESETS.themes) {
      expect(theme.canvas.gridSpacing).toBe(24);
    }
  });
});

describe('migrateThemeId', () => {
  test('旧暗色系主题全部迁移到 dark', () => {
    for (const legacy of ['dark', 'cyberpunk', 'ocean', 'sunset', 'forest']) {
      expect(migrateThemeId(legacy)).toBe('dark');
    }
  });

  test('light 原样保留', () => {
    expect(migrateThemeId('light')).toBe('light');
  });

  test('null 与未知值返回 null（走系统偏好检测）', () => {
    expect(migrateThemeId(null)).toBeNull();
    expect(migrateThemeId('nonexistent')).toBeNull();
  });
});
