import { describe, test, expect } from 'vitest';
import { resolveEntityStyle, interpolateStyle } from '@/utils/frame/style-utils';
import type { RendererPalette } from '@/types/theme';
import type { RenderStyle, StateTag } from '@/types/timeline';

const PALETTE: RendererPalette = {
  background: '#0b0e14',
  backgroundSecondary: '#11151d',
  text: '#9aa4b5',
  indexText: '#5c6675',
  shadowBlur: 9,
  grid: 'rgba(255,255,255,0.045)',
  gridSpacing: 24,
  baseline: 'rgba(255,255,255,0.14)',
  states: {
    pending: { fill: '#3d4f66', glow: 0 },
    'heap-pending': { fill: '#2b3a52', glow: 0 },
    comparing: { fill: '#f5c542', glow: 0.8 },
    swapping: { fill: '#ff5d5d', glow: 1 },
    sorted: { fill: '#3ecf8e', glow: 0 },
    pivot: { fill: '#b78cff', glow: 0.7 },
    latest: { fill: '#22d3ee', glow: 0 },
  },
  accent: '#89b4fa',
  uiText: '#e8ecf3',
  uiTextSecondary: '#9aa4b5',
  uiTextMuted: '#5c6675',
  border: 'rgba(255,255,255,0.08)',
};

describe('resolveEntityStyle', () => {
  test('按传入顺序取首个命中标签', () => {
    expect(resolveEntityStyle(['comparing', 'sorted'], PALETTE).fill).toBe('#f5c542');
    expect(resolveEntityStyle(['sorted', 'comparing'], PALETTE).fill).toBe('#3ecf8e');
  });

  test('空 tags 回退 pending 基底（画廊石板灰）', () => {
    const result = resolveEntityStyle([], PALETTE);
    expect(result.fill).toBe('#3d4f66');
    expect(result.glow).toBe(0);
  });

  test('每个 tag 都能命中对应状态色', () => {
    const cases: Array<[StateTag, string]> = [
      ['pending', '#3d4f66'],
      ['heap-pending', '#2b3a52'],
      ['comparing', '#f5c542'],
      ['swapping', '#ff5d5d'],
      ['sorted', '#3ecf8e'],
      ['pivot', '#b78cff'],
      ['latest', '#22d3ee'],
    ];
    for (const [tag, fill] of cases) {
      expect(resolveEntityStyle([tag], PALETTE).fill).toBe(fill);
    }
  });

  test('未知 tag（防御）跳过并继续匹配后续标签', () => {
    expect(resolveEntityStyle(['unknown' as StateTag, 'pivot'], PALETTE).fill).toBe('#b78cff');
  });
});

describe('interpolateStyle（瘦身后：仅 dashed/alpha）', () => {
  test('dashed 在 progress<0.5 取 from、>=0.5 取 to（二值切换语义保留）', () => {
    const from: RenderStyle = { dashed: false };
    const to: RenderStyle = { dashed: true };
    expect(interpolateStyle(from, to, 0.3).dashed).toBe(false);
    expect(interpolateStyle(from, to, 0.5).dashed).toBe(true);
    expect(interpolateStyle(from, to, 0.7).dashed).toBe(true);
  });

  test('alpha 线性插值', () => {
    const from: RenderStyle = { alpha: 1 };
    const to: RenderStyle = { alpha: 0 };
    expect(interpolateStyle(from, to, 0).alpha).toBe(1);
    expect(interpolateStyle(from, to, 0.5).alpha).toBe(0.5);
    expect(interpolateStyle(from, to, 1).alpha).toBe(0);
  });

  test('alpha 仅在一方定义时注入，未定义侧按不透明 1 处理（CLAUDE.md 经验 #1 防御保留）', () => {
    expect(interpolateStyle({}, {}, 0.5).alpha).toBeUndefined();
    // to 未定义视为不透明：1→1 全程恒 1
    expect(interpolateStyle({ alpha: 1 }, {}, 0.5).alpha).toBe(1);
    // from 未定义视为不透明：1→0 中点 0.5
    expect(interpolateStyle({}, { alpha: 0 }, 0.5).alpha).toBe(0.5);
  });

  test('结果不含任何颜色字段', () => {
    const result = interpolateStyle({ dashed: true, alpha: 1 }, { dashed: false, alpha: 0 }, 0.5);
    expect(Object.keys(result).sort()).toEqual(['alpha', 'dashed']);
  });
});
