import { describe, test, expect } from 'vitest';
import {
  getStyleFromStateTags,
  interpolateStyle,
  BAR_BASE_STYLE
} from '@/utils/frame/style-utils';
import type { RenderStyle, StateTag } from '@/types/timeline';

describe('style-utils', () => {
  describe('getStyleFromStateTags', () => {
    test('应该返回第一个匹配标签的样式', () => {
      const stateTags: StateTag[] = ['comparing', 'sorted'];
      const fallback: RenderStyle = { fill: '#000', stroke: '#fff', text: '#000', glow: 0 };

      const result = getStyleFromStateTags(stateTags, fallback);

      // 应该返回 comparing 的样式（第一个匹配）
      expect(result.fill).toBe('#ffcc00');
    });

    test('没有匹配标签时应该返回fallback', () => {
      const stateTags: StateTag[] = [];
      const fallback: RenderStyle = {
        fill: '#custom',
        stroke: '#custom-stroke',
        text: '#custom-text',
        glow: 0.5
      };

      const result = getStyleFromStateTags(stateTags, fallback);

      expect(result.fill).toBe('#custom');
      expect(result.stroke).toBe('#custom-stroke');
      expect(result.text).toBe('#custom-text');
      expect(result.glow).toBe(0.5);
    });

    test('应该正确合并样式', () => {
      const stateTags: StateTag[] = ['comparing'];
      const fallback: RenderStyle = {
        fill: '#fallback',
        stroke: '#fallback-stroke',
        text: '#fallback-text',
        glow: 0.1,
        alpha: 0.8,
        dashed: true
      };

      const result = getStyleFromStateTags(stateTags, fallback);

      // 标签样式应该覆盖fallback
      expect(result.fill).toBe('#ffcc00');
      expect(result.glow).toBe(0.72);

      // fallback中特有的属性应该保留
      expect(result.alpha).toBe(0.8);
      expect(result.dashed).toBe(true);
    });

    test('应该按优先级匹配标签', () => {
      const testCases: Array<{ tags: StateTag[]; expectedFill: string }> = [
        { tags: ['pivot'], expectedFill: '#b979ff' },
        { tags: ['swapping'], expectedFill: '#ff5c5c' },
        { tags: ['comparing'], expectedFill: '#ffcc00' },
        { tags: ['pending'], expectedFill: '#00c8d4' },
        { tags: ['sorted'], expectedFill: '#33d17a' },
        { tags: ['latest'], expectedFill: '#4ecdc4' },
        { tags: ['heap-pending'], expectedFill: '#2e5490' }
      ];

      testCases.forEach(({ tags, expectedFill }) => {
        const fallback: RenderStyle = { fill: '#000', stroke: '#fff', text: '#000', glow: 0 };
        const result = getStyleFromStateTags(tags, fallback);
        expect(result.fill).toBe(expectedFill);
      });
    });

    test('应该正确处理heap-pending标签', () => {
      const stateTags: StateTag[] = ['heap-pending'];
      const fallback: RenderStyle = { fill: '#000', stroke: '#fff', text: '#000', glow: 0 };

      const result = getStyleFromStateTags(stateTags, fallback);

      expect(result.fill).toBe('#2e5490');
      expect(result.stroke).toBe('rgba(90, 140, 210, 0.7)');
      expect(result.text).toBe('#b8d0f0');
      expect(result.glow).toBe(0.15);
    });
  });

  describe('interpolateStyle', () => {
    test('应该在progress < 0.5时返回from样式', () => {
      const from: RenderStyle = {
        fill: '#ff0000',
        stroke: '#ffcccc',
        text: '#ff0000',
        glow: 0.2,
        dashed: false,
        alpha: 1
      };

      const to: RenderStyle = {
        fill: '#00ff00',
        stroke: '#ccffcc',
        text: '#00ff00',
        glow: 0.8,
        dashed: true,
        alpha: 0.5
      };

      const result = interpolateStyle(from, to, 0.3);

      expect(result.fill).toBe('#ff0000');
      expect(result.stroke).toBe('#ffcccc');
      expect(result.text).toBe('#ff0000');
      expect(result.dashed).toBe(false);
    });

    test('应该在progress >= 0.5时返回to样式', () => {
      const from: RenderStyle = {
        fill: '#ff0000',
        stroke: '#ffcccc',
        text: '#ff0000',
        glow: 0.2,
        dashed: false,
        alpha: 1
      };

      const to: RenderStyle = {
        fill: '#00ff00',
        stroke: '#ccffcc',
        text: '#00ff00',
        glow: 0.8,
        dashed: true,
        alpha: 0.5
      };

      const result = interpolateStyle(from, to, 0.7);

      expect(result.fill).toBe('#00ff00');
      expect(result.stroke).toBe('#ccffcc');
      expect(result.text).toBe('#00ff00');
      expect(result.dashed).toBe(true);
    });

    test('应该在progress = 0.5时切换样式', () => {
      const from: RenderStyle = {
        fill: '#ff0000',
        stroke: '#ffcccc',
        text: '#ff0000',
        glow: 0.2,
        dashed: false,
        alpha: 1
      };

      const to: RenderStyle = {
        fill: '#00ff00',
        stroke: '#ccffcc',
        text: '#00ff00',
        glow: 0.8,
        dashed: true,
        alpha: 0.5
      };

      const result = interpolateStyle(from, to, 0.5);

      // 在临界点应该切换到to样式
      expect(result.fill).toBe('#00ff00');
      expect(result.stroke).toBe('#ccffcc');
      expect(result.text).toBe('#00ff00');
    });

    test('应该正确插值glow属性', () => {
      const from: RenderStyle = { fill: '#f00', stroke: '#fcc', text: '#f00', glow: 0 };
      const to: RenderStyle = { fill: '#0f0', stroke: '#cfc', text: '#0f0', glow: 1 };

      const result0 = interpolateStyle(from, to, 0);
      const result05 = interpolateStyle(from, to, 0.5);
      const result1 = interpolateStyle(from, to, 1);

      expect(result0.glow).toBe(0);
      expect(result05.glow).toBe(0.5);
      expect(result1.glow).toBe(1);
    });

    test('应该正确插值alpha属性', () => {
      const from: RenderStyle = {
        fill: '#f00',
        stroke: '#fcc',
        text: '#f00',
        glow: 0,
        alpha: 1
      };

      const to: RenderStyle = {
        fill: '#0f0',
        stroke: '#cfc',
        text: '#0f0',
        glow: 0,
        alpha: 0
      };

      const result0 = interpolateStyle(from, to, 0);
      const result05 = interpolateStyle(from, to, 0.5);
      const result1 = interpolateStyle(from, to, 1);

      expect(result0.alpha).toBe(1);
      expect(result05.alpha).toBe(0.5);
      expect(result1.alpha).toBe(0);
    });

    test('当alpha未定义时应该返回undefined', () => {
      const from: RenderStyle = { fill: '#f00', stroke: '#fcc', text: '#f00', glow: 0 };
      const to: RenderStyle = { fill: '#0f0', stroke: '#cfc', text: '#0f0', glow: 0 };

      const result = interpolateStyle(from, to, 0.5);

      expect(result.alpha).toBeUndefined();
    });

    test('应该处理部分alpha定义', () => {
      const from: RenderStyle = { fill: '#f00', stroke: '#fcc', text: '#f00', glow: 0, alpha: 1 };
      const to: RenderStyle = { fill: '#0f0', stroke: '#cfc', text: '#0f0', glow: 0 };

      const result = interpolateStyle(from, to, 0.5);

      expect(result.alpha).toBe(0.5);
    });

    test('应该处理边界progress值', () => {
      const from: RenderStyle = {
        fill: '#f00',
        stroke: '#fcc',
        text: '#f00',
        glow: 0.2,
        dashed: false,
        alpha: 1
      };

      const to: RenderStyle = {
        fill: '#0f0',
        stroke: '#cfc',
        text: '#0f0',
        glow: 0.8,
        dashed: true,
        alpha: 0.5
      };

      const result0 = interpolateStyle(from, to, 0);
      const result1 = interpolateStyle(from, to, 1);
      const resultNegative = interpolateStyle(from, to, -0.1);
      const resultOver1 = interpolateStyle(from, to, 1.1);

      // progress = 0
      expect(result0.fill).toBe('#f00');
      expect(result0.glow).toBe(0.2);
      expect(result0.alpha).toBe(1);

      // progress = 1
      expect(result1.fill).toBe('#0f0');
      expect(result1.glow).toBe(0.8);
      expect(result1.alpha).toBe(0.5);

      // 负值应该被当作0处理
      expect(resultNegative.fill).toBe('#f00');
      expect(resultNegative.glow).toBeCloseTo(0.2, 5);

      // 超过1应该被当作1处理
      expect(resultOver1.fill).toBe('#0f0');
      expect(resultOver1.glow).toBeCloseTo(0.8, 5);
    });
  });

  describe('BAR_BASE_STYLE', () => {
    test('应该有正确的默认值', () => {
      expect(BAR_BASE_STYLE.fill).toBe('#4a9eff');
      expect(BAR_BASE_STYLE.stroke).toBe('rgba(126, 214, 255, 0.52)');
      expect(BAR_BASE_STYLE.text).toBe('#ffd43b');
      expect(BAR_BASE_STYLE.glow).toBe(0);
    });

    test('应该是一个不可变的常量', () => {
      // 尝试修改不应该影响原始值
      const testStyle = { ...BAR_BASE_STYLE };
      testStyle.fill = '#modified';

      expect(BAR_BASE_STYLE.fill).toBe('#4a9eff');
    });
  });

  describe('样式优先级测试', () => {
    test('多个标签时的优先级处理', () => {
      const highPriorityTags: StateTag[] = ['pivot', 'comparing'];
      const lowPriorityTags: StateTag[] = ['sorted', 'comparing'];

      const fallback: RenderStyle = {
        fill: '#000',
        stroke: '#fff',
        text: '#000',
        glow: 0
      };

      const highResult = getStyleFromStateTags(highPriorityTags, fallback);
      const lowResult = getStyleFromStateTags(lowPriorityTags, fallback);

      // pivot应该优先于comparing
      expect(highResult.fill).toBe('#b979ff');

      // comparing应该优先于sorted
      expect(lowResult.fill).toBe('#ffcc00');
    });

    test('标签样式应该覆盖fallback', () => {
      const stateTags: StateTag[] = ['comparing'];
      const fallback: RenderStyle = {
        fill: '#fallback',
        stroke: '#fallback-stroke',
        text: '#fallback-text',
        glow: 1,
        dashed: true
      };

      const result = getStyleFromStateTags(stateTags, fallback);

      // 标签样式属性应该覆盖
      expect(result.fill).toBe('#ffcc00');
      expect(result.glow).toBe(0.72);

      // fallback独有的属性应该保留
      expect(result.dashed).toBe(true);
    });
  });

  describe('边界情况处理', () => {
    test('应该处理缺失的glow属性', () => {
      const from: RenderStyle = { fill: '#f00', stroke: '#fcc', text: '#f00' };
      const to: RenderStyle = { fill: '#0f0', stroke: '#cfc', text: '#0f0', glow: 1 };

      const result = interpolateStyle(from, to, 0.5);

      expect(result.glow).toBe(0.5); // from.glow默认为0
    });

    test('应该处理undefined的stroke和text', () => {
      const from: RenderStyle = { fill: '#f00', text: '#f00', glow: 0 };
      const to: RenderStyle = { fill: '#0f0', stroke: '#cfc', text: '#0f0', glow: 0 };

      const result = interpolateStyle(from, to, 0.3);

      expect(result.stroke).toBeUndefined();
      expect(result.fill).toBe('#f00');
    });
  });
});
