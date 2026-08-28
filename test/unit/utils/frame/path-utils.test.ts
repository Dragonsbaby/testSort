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
      // "减速"指斜率递减：等距采样的增量 early > mid > late
      const earlyGain = easeOutCubic(0.2) - easeOutCubic(0);
      const midGain = easeOutCubic(0.6) - easeOutCubic(0.4);
      const lateGain = easeOutCubic(1) - easeOutCubic(0.8);

      expect(earlyGain).toBeGreaterThan(midGain);
      expect(midGain).toBeGreaterThan(lateGain);
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
    // 实现契约：第 4 参数为 pathParams 对象（mode / curveHeight，弧顶偏移默认 48）；
    // 前半段（t≤0.5）完成主轴全部位移，弧顶偏移只作用于 y 分量
    test('horizontal-first 模式：前半段完成水平位移', () => {
      const start = { x: 0, y: 0 };
      const end = { x: 100, y: 50 };
      const params = { mode: 'horizontal-first', curveHeight: 20 };

      // t=0.2（前半段 localProgress=0.4）：x 走到 40，y 被 sin 弧顶抬高
      const earlyPoint = getPathPoint(start, end, 0.2, params);
      expect(earlyPoint.x).toBeCloseTo(40, 5);
      expect(earlyPoint.y).toBeCloseTo(-Math.sin(0.4 * Math.PI) * 20, 5);

      // t=0.8（后半段 localProgress=0.6）：x 已到位，y 走到 30 带残余弧偏移（0.35 衰减）
      const latePoint = getPathPoint(start, end, 0.8, params);
      expect(latePoint.x).toBeCloseTo(100, 5);
      expect(latePoint.y).toBeCloseTo(30 - Math.sin(0.4 * Math.PI) * 20 * 0.35, 5);
    });

    test('vertical-first 模式：前半段完成垂直位移', () => {
      const start = { x: 0, y: 0 };
      const end = { x: 100, y: 50 };
      const params = { mode: 'vertical-first', curveHeight: 20 };

      // t=0.2：y 走到 20（含弧顶抬升），x 仍为 0
      const earlyPoint = getPathPoint(start, end, 0.2, params);
      expect(earlyPoint.y).toBeCloseTo(20 - Math.sin(0.4 * Math.PI) * 20, 5);
      expect(earlyPoint.x).toBeCloseTo(0, 5);

      // t=0.8：y 已到位，x 走到 60
      const latePoint = getPathPoint(start, end, 0.8, params);
      expect(latePoint.y).toBeCloseTo(50 - Math.sin(0.4 * Math.PI) * 20 * 0.35, 5);
      expect(latePoint.x).toBeCloseTo(60, 5);
    });

    test('起点和终点应该匹配', () => {
      const start = { x: 0, y: 0 };
      const end = { x: 100, y: 50 };

      ['horizontal-first', 'vertical-first'].forEach(mode => {
        const params = { mode, curveHeight: 20 };
        const startPoint = getPathPoint(start, end, 0, params);
        const endPoint = getPathPoint(start, end, 1, params);

        expect(startPoint.x).toBeCloseTo(start.x, 5);
        expect(startPoint.y).toBeCloseTo(start.y, 5);

        expect(endPoint.x).toBeCloseTo(end.x, 5);
        expect(endPoint.y).toBeCloseTo(end.y, 5);
      });
    });

    test('转角点（t=0.5）：主轴位移已走完，弧偏移恰好归零', () => {
      const start = { x: 0, y: 0 };
      const end = { x: 100, y: 100 };
      const params = { mode: 'horizontal-first', curveHeight: 30 };

      const cornerPoint = getPathPoint(start, end, 0.5, params);

      // 前半段终点 = (end.x, start.y)；sin(π)=0 弧偏移归零（存在浮点噪声，用近似断言）
      expect(cornerPoint.x).toBeCloseTo(100, 5);
      expect(cornerPoint.y).toBeCloseTo(0, 5);
    });

    test('应该处理零距离情况', () => {
      const point = getPathPoint(
        { x: 50, y: 50 },
        { x: 50, y: 50 },
        0.5,
        { mode: 'horizontal-first', curveHeight: 20 },
      );

      expect(point.x).toBeCloseTo(50, 5);
      expect(point.y).toBeCloseTo(50, 5);
    });

    test('应该处理纯水平移动', () => {
      const point = getPathPoint(
        { x: 0, y: 100 },
        { x: 100, y: 100 },
        0.5,
        { mode: 'horizontal-first', curveHeight: 20 },
      );

      // 水平位移在前半段已全部完成
      expect(point.x).toBeCloseTo(100, 5);
      expect(point.y).toBeCloseTo(100, 5);
    });

    test('应该处理纯垂直移动', () => {
      const point = getPathPoint(
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        0.5,
        { mode: 'vertical-first', curveHeight: 20 },
      );

      // 垂直位移在前半段已全部完成
      expect(point.x).toBeCloseTo(100, 5);
      expect(point.y).toBeCloseTo(100, 5);
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
      const params = { mode: 'horizontal-first', curveHeight: 20 };

      const points = Array.from({ length: 100 }, (_, i) =>
        getPathPoint(start, end, i / 99, params)
      );

      for (let i = 1; i < points.length; i++) {
        // x 单调不减（前半段递增、后半段恒定）；相邻点距无跳变
        expect(points[i].x).toBeGreaterThanOrEqual(points[i - 1].x - 1e-9);
        const dx = points[i].x - points[i - 1].x;
        const dy = points[i].y - points[i - 1].y;
        expect(Math.hypot(dx, dy)).toBeLessThan(5);
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
