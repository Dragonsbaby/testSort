import { describe, test, expect } from 'vitest';
import { mixHex, mixRendererPalette, easeOutCubic } from '@/utils/frame/palette-mixer';
import type { RendererPalette } from '@/types/theme';

function makePalette(fill: string, glow: number, shadowBlur: number): RendererPalette {
  return {
    background: fill,
    backgroundSecondary: fill,
    text: fill,
    indexText: fill,
    shadowBlur,
    grid: 'rgba(0,0,0,0.1)',
    gridSpacing: 24,
    baseline: 'rgba(0,0,0,0.2)',
    states: {
      comparing: { fill, glow },
      swapping: { fill, glow },
      sorted: { fill, glow },
      pivot: { fill, glow },
      pending: { fill, glow },
      'heap-pending': { fill, glow },
      latest: { fill, glow },
    },
    accent: fill,
    uiText: fill,
    uiTextSecondary: fill,
    uiTextMuted: fill,
    border: 'rgba(0,0,0,0.3)',
  };
}

describe('mixHex', () => {
  test('t=0 返回 a，t=1 返回 b', () => {
    expect(mixHex('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mixHex('#000000', '#ffffff', 1)).toBe('#ffffff');
  });

  test('t=0.5 每通道取中点', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mixHex('#3d4f66', '#a8b3c4', 0.5)).toBe('#738195');
  });

  test('四舍五入到最近整数通道值', () => {
    // (0x3d + 0xa8) / 2 = 114.5 → Math.round = 115 = 0x73
    expect(mixHex('#3d0000', '#a80000', 0.5)).toBe('#730000');
  });
});

describe('mixRendererPalette', () => {
  const from = makePalette('#3d4f66', 0, 9);
  const to = makePalette('#a8b3c4', 1, 0);

  test('t=0 等于 from，t=1 等于 to（混合字段）', () => {
    expect(mixRendererPalette(from, to, 0).background).toBe('#3d4f66');
    expect(mixRendererPalette(from, to, 1).background).toBe('#a8b3c4');
  });

  test('states.fill 与 glow 参与混合', () => {
    const mid = mixRendererPalette(from, to, 0.5);
    expect(mid.states.pending.fill).toBe('#738195');
    expect(mid.states.pending.glow).toBe(0.5);
  });

  test('shadowBlur 数值线性混合', () => {
    expect(mixRendererPalette(from, to, 0.5).shadowBlur).toBe(4.5);
  });

  test('grid/gridSpacing/baseline/border 不混合，直接取 to', () => {
    const mid = mixRendererPalette(from, to, 0.5);
    expect(mid.grid).toBe(to.grid);
    expect(mid.gridSpacing).toBe(to.gridSpacing);
    expect(mid.baseline).toBe(to.baseline);
    expect(mid.border).toBe(to.border);
  });
});

describe('easeOutCubic', () => {
  test('标准缓出曲线', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 5);
  });
});
