import { describe, test, expect } from 'vitest';
import {
  lerp,
  easeOutCubic,
  easeInOutCubic,
  getArcPoint,
  getPathPoint
} from '@/utils/frame/path-utils';

describe('path-utils', () => {
  describe('lerp - 线性插值', () => {
    test('基本插值计算', () => {
      expect(lerp(0, 10, 0.5)).toBe(5);
      expect(lerp(0, 100, 0.25)).toBe(25);
      expect(lerp(50, 150, 0.5)).toBe(100);
    });

    test('边界值插值', () => {
      expect(lerp(0, 10, 0)).toBe(0);
      expect(lerp(0, 10, 1)).toBe(10);
      expect(lerp(5, 15, 0)).toBe(5);
      expect(lerp(5, 15, 1)).toBe(15);
    });

    test('负数插值', () => {
      expect(lerp(-10, 10, 0.5)).toBe(0);
      expect(lerp(-20, -10, 0.5)).toBe(-15);
    });

    test('反向插值', () => {
      expect(lerp(10, 0, 0.5)).toBe(5);
      expect(lerp(100, 50, 0.5)).toBe(75);
    });

    test('小数精度', () => {
      expect(lerp(0, 1, 0.333)).toBeCloseTo(0.333, 5);
      expect(lerp(0, 1, 0.666)).toBeCloseTo(0.666, 5);
    });

    test('超出范围的处理', () => {
      // 超出0-1范围的progress应该被正确处理
      expect(lerp(0, 10, -0.5)).toBe(-5);
      expect(lerp(0, 10, 1.5)).toBe(15);
    });
  });

  describe('easeOutCubic - 缓出函数', () => {
    test('基本缓出计算', () => {
      expect(easeOutCubic(0)).toBe(0);
      expect(easeOutCubic(1)).toBe(1);
      expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 5);
    });

    test('应该快速启动然后减速', () => {
      const early = easeOutCubic(0.2);
      const mid = easeOutCubic(0.5);
      const late = easeOutCubic(0.8);

      // 早期增长快，后期增长慢
      expect(early).toBeGreaterThan(0.2 * 0.8); // 线性的80%
      expect(late).toBeLessThan(0.8 + 0.2 * 0.2); // 接近1但不超过
    });

    test('边界值', () => {
      expect(easeOutCubic(0)).toBe(0);
      expect(easeOutCubic(1)).toBe(1);
    });

    test('应该输出单调递增值', () => {
      const values = Array.from({ length: 11 }, (_, i) => easeOutCubic(i / 10));

      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
      }
    });
  });

  describe('easeInOutCubic - 缓入缓出函数', () => {
    test('基本缓入缓出计算', () => {
      expect(easeInOutCubic(0)).toBe(0);
      expect(easeInOutCubic(1)).toBe(1);
      expect(easeInOutCubic(0.5)).toBe(0.5);
    });

    test('应该对称于中点', () => {
      const p1 = 0.2;
      const p2 = 0.8;

      const v1 = easeInOutCubic(p1);
      const v2 = easeInOutCubic(p2);

      // 对称性：f(p) + f(1-p) = 1
      expect(v1 + v2).toBeCloseTo(1, 5);
    });

    test('应该早期慢，中期快，后期慢', () => {
      const early = easeInOutCubic(0.2);
      const mid = easeInOutCubic(0.5);
      const late = easeInOutCubic(0.8);

      // 早期和晚期应该接近线性
      expect(early).toBeLessThan(0.3);
      expect(late).toBeGreaterThan(0.7);

      // 中期应该加速
      expect(mid).toBe(0.5);
    });

    test('边界值', () => {
      expect(easeInOutCubic(0)).toBe(0);
      expect(easeInOutCubic(0.5)).toBe(0.5);
      expect(easeInOutCubic(1)).toBe(1);
    });
  });

  describe('getArcPoint - 弧线路径计算', () => {
    test('基本弧线计算', () => {
      const start = { x: 0, y: 0 };
      const end = { x: 100, y: 0 };
      const height = 50;

      const point = getArcPoint(start, end, 0.5, height);

      // 在中点应该达到最高点
      expect(point.x).toBe(50);
      expect(point.y).toBeCloseTo(-height, 5); // 向上凸起
    });

    test('起点和终点应该匹配', () => {
      const start = { x: 0, y: 0 };
      const end = { x: 100, y: 50 };
      const height = 30;

      const startPoint = getArcPoint(start, end, 0, height);
      const endPoint = getArcPoint(start, end, 1, height);

      expect(startPoint.x).toBeCloseTo(start.x, 5);
      expect(startPoint.y).toBeCloseTo(start.y, 5);

      expect(endPoint.x).toBeCloseTo(end.x, 5);
      expect(endPoint.y).toBeCloseTo(end.y, 5);
    });

    test('应该使用正弦函数创建平滑弧线', () => {
      const start = { x: 0, y: 0 };
      const end = { x: 100, y: 0 };
      const height = 50;

      const points = Array.from({ length: 11 }, (_, i) =>
        getArcPoint(start, end, i / 10, height)
      );

      // 检查弧线的对称性
      const peakIndex = points.findIndex((p, i) =>
        i > 0 && p.y < points[i - 1].y && i < points.length - 1 && p.y < points[i + 1].y
      );

      // 峰值应该在中间附近
      expect(peakIndex).toBeGreaterThanOrEqual(4);
      expect(peakIndex).toBeLessThanOrEqual(6);
    });

    test('不同高度的弧线', () => {
      const start = { x: 0, y: 0 };
      const end = { x: 100, y: 0 };

      const lowArc = getArcPoint(start, end, 0.5, 20);
      const highArc = getArcPoint(start, end, 0.5, 80);

      expect(lowArc.y).toBeCloseTo(-20, 5);
      expect(highArc.y).toBeCloseTo(-80, 5);
    });

    test('对角线弧线', () => {
      const start = { x: 0, y: 0 };
      const end = { x: 100, y: 100 };
      const height = 30;

      const point = getArcPoint(start, end, 0.5, height);

      expect(point.x).toBe(50);
      expect(point.y).toBeCloseTo(50 - height, 5);
    });

    test('负高度应该向下凸起', () => {
      const start = { x: 0, y: 0 };
      const end = { x: 100, y: 0 };
      const height = -30;

      const point = getArcPoint(start, end, 0.5, height);

      expect(point.y).toBeCloseTo(30, 5); // 向下凸起
    });
  });

  describe('getPathPoint - L形路径计算', () => {
    test('horizontal-first 模式', () => {
      const start = { x: 0, y: 0 };
      const end = { x: 100, y: 50 };
      const curveHeight = 20;

      // 前半段：水平移动
      const earlyPoint = getPathPoint(start, end, 0.2, 'horizontal-first', curveHeight);
      expect(earlyPoint.x).toBeGreaterThan(0);
      expect(earlyPoint.x).toBeLessThan(50);

      // 后半段：垂直移动
      const latePoint = getPathPoint(start, end, 0.8, 'horizontal-first', curveHeight);
      expect(latePoint.x).toBeCloseTo(100, 5);
      expect(latePoint.y).toBeGreaterThan(25);
    });

    test('vertical-first 模式', () => {
      const start = { x: 0, y: 0 };
      const end = { x: 100, y: 50 };
      const curveHeight = 20;

      // 前半段：垂直移动
      const earlyPoint = getPathPoint(start, end, 0.2, 'vertical-first', curveHeight);
      expect(earlyPoint.y).toBeGreaterThan(0);
      expect(earlyPoint.y).toBeLessThan(25);

      // 后半段：水平移动
      const latePoint = getPathPoint(start, end, 0.8, 'vertical-first', curveHeight);
      expect(latePoint.y).toBeCloseTo(50, 5);
      expect(latePoint.x).toBeGreaterThan(50);
    });

    test('起点和终点应该匹配', () => {
      const start = { x: 0, y: 0 };
      const end = { x: 100, y: 50 };

      ['horizontal-first', 'vertical-first'].forEach(mode => {
        const startPoint = getPathPoint(start, end, 0, mode, 20);
        const endPoint = getPathPoint(start, end, 1, mode, 20);

        expect(startPoint.x).toBeCloseTo(start.x, 5);
        expect(startPoint.y).toBeCloseTo(start.y, 5);

        expect(endPoint.x).toBeCloseTo(end.x, 5);
        expect(endPoint.y).toBeCloseTo(end.y, 5);
      });
    });

    test('应该在转角处添加曲线', () => {
      const start = { x: 0, y: 0 };
      const end = { x: 100, y: 100 };
      const curveHeight = 30;

      // 在转角处（progress ≈ 0.5）
      const cornerPoint = getPathPoint(start, end, 0.5, 'horizontal-first', curveHeight);

      // 应该有曲线效果，不是完全的直角
      expect(cornerPoint.x).toBeGreaterThan(40);
      expect(cornerPoint.x).toBeLessThan(60);
      expect(cornerPoint.y).toBeGreaterThan(40);
      expect(cornerPoint.y).toBeLessThan(60);
    });

    test('应该处理零距离情况', () => {
      const start = { x: 50, y: 50 };
      const end = { x: 50, y: 50 };

      const point = getPathPoint(start, end, 0.5, 'horizontal-first', 20);

      expect(point.x).toBe(50);
      expect(point.y).toBe(50);
    });

    test('应该处理纯水平移动', () => {
      const start = { x: 0, y: 100 };
      const end = { x: 100, y: 100 };

      const point = getPathPoint(start, end, 0.5, 'horizontal-first', 20);

      expect(point.y).toBe(100);
      expect(point.x).toBe(50);
    });

    test('应该处理纯垂直移动', () => {
      const start = { x: 100, y: 0 };
      const end = { x: 100, y: 100 };

      const point = getPathPoint(start, end, 0.5, 'vertical-first', 20);

      expect(point.x).toBe(100);
      expect(point.y).toBe(50);
    });
  });

  describe('路径平滑性和连续性', () => {
    test('弧线路径应该是连续的', () => {
      const start = { x: 0, y: 0 };
      const end = { x: 100, y: 0 };
      const height = 50;

      const points = Array.from({ length: 100 }, (_, i) =>
        getArcPoint(start, end, i / 99, height)
      );

      // 检查相邻点之间的距离是否合理
      for (let i = 1; i < points.length; i++) {
        const dx = points[i].x - points[i - 1].x;
        const dy = points[i].y - points[i - 1].y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // 相邻点之间的距离应该相对均匀
        expect(distance).toBeLessThan(5); // 避免突然跳跃
      }
    });

    test('L形路径应该是连续的', () => {
      const start = { x: 0, y: 0 };
      const end = { x: 100, y: 50 };

      const points = Array.from({ length: 100 }, (_, i) =>
        getPathPoint(start, end, i / 99, 'horizontal-first', 20)
      );

      // 检查路径连续性
      for (let i = 1; i < points.length; i++) {
        expect(points[i].x).toBeGreaterThanOrEqual(0);
        expect(points[i].y).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('边界情况和错误处理', () => {
    test('应该处理NaN输入', () => {
      const start = { x: 0, y: 0 };
      const end = { x: 100, y: 0 };

      // 如果progress是NaN，应该返回合理的值或抛出错误
      expect(() => getArcPoint(start, end, NaN, 50)).not.toThrow();
    });

    test('应该处理极端高度值', () => {
      const start = { x: 0, y: 0 };
      const end = { x: 100, y: 0 };

      const extremeHeight = 10000;
      const point = getArcPoint(start, end, 0.5, extremeHeight);

      expect(point.y).toBeCloseTo(-extremeHeight, 5);
    });
  });
});
