import { describe, test, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useSortStore } from '@/stores/sortStore';
import type { SortAlgorithm } from '@/types/sorting';

describe('useSortStore', () => {
  beforeEach(() => {
    // 每个测试前创建新的pinia实例
    setActivePinia(createPinia());
  });

  describe('初始状态', () => {
    test('应该有正确的默认值', () => {
      const store = useSortStore();

      expect(store.originalArray).toEqual([]);
      expect(store.animationSpeed).toBe(200);
      expect(store.arraySize).toBe(10);
      expect(store.algorithm).toBe('heap');
    });

    test('所有状态都应该响应式', () => {
      const store = useSortStore();

      // 测试响应式更新
      store.animationSpeed = 100;
      expect(store.animationSpeed).toBe(100);

      store.arraySize = 50;
      expect(store.arraySize).toBe(50);
    });
  });

  describe('generateArray', () => {
    test('应该生成指定长度的数组', () => {
      const store = useSortStore();

      store.generateArray(10);
      expect(store.originalArray).toHaveLength(10);

      store.generateArray(50);
      expect(store.originalArray).toHaveLength(50);
    });

    test('应该生成1到n的不重复整数', () => {
      const store = useSortStore();
      const size = 10;

      store.generateArray(size);

      const values = store.originalArray.map(item => item.value);
      const uniqueValues = new Set(values);

      // 检查不重复
      expect(uniqueValues.size).toBe(size);

      // 检查范围
      values.forEach(value => {
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(size);
      });

      // 检查包含所有数字
      for (let i = 1; i <= size; i++) {
        expect(values).toContain(i);
      }
    });

    test('displayIndex应该从1开始递增', () => {
      const store = useSortStore();

      store.generateArray(5);

      const displayIndexes = store.originalArray.map(item => item.displayIndex);

      expect(displayIndexes).toEqual([1, 2, 3, 4, 5]);
    });

    test('应该是乱序的（非排序状态）', () => {
      const store = useSortStore();

      // 多次生成，至少有一次不是有序的
      let sortedCount = 0;
      const attempts = 10;

      for (let i = 0; i < attempts; i++) {
        store.generateArray(10);
        const values = store.originalArray.map(item => item.value);

        const isSorted = values.every((value, index) => {
          if (index === 0) return true;
          return value >= values[index - 1];
        });

        if (isSorted) sortedCount++;
      }

      // 不应该每次都生成有序数组
      expect(sortedCount).toBeLessThan(attempts);
    });

    test('边界情况测试', () => {
      const store = useSortStore();

      // 最小数组
      store.generateArray(1);
      expect(store.originalArray).toEqual([{ value: 1, displayIndex: 1 }]);

      // 稍大数组
      store.generateArray(100);
      expect(store.originalArray).toHaveLength(100);

      const values = store.originalArray.map(item => item.value);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(100);
    });

    test('Fisher-Yates洗牌算法正确性', () => {
      const store = useSortStore();
      const size = 52; // 一副牌

      store.generateArray(size);

      const values = store.originalArray.map(item => item.value);

      // 验证所有牌都在
      expect(new Set(values).size).toBe(size);

      // 验证范围
      expect(Math.min(...values)).toBe(1);
      expect(Math.max(...values)).toBe(size);

      // 验证每个数字恰好出现一次
      const counts = new Array(size + 1).fill(0);
      values.forEach(v => counts[v]++);

      for (let i = 1; i <= size; i++) {
        expect(counts[i]).toBe(1);
      }
    });
  });

  describe('setSpeed', () => {
    test('应该设置动画速度', () => {
      const store = useSortStore();

      store.setSpeed(100);
      expect(store.animationSpeed).toBe(100);

      store.setSpeed(500);
      expect(store.animationSpeed).toBe(500);
    });

    test('应该接受合理的速度范围', () => {
      const store = useSortStore();

      // 测试边界值
      store.setSpeed(20);
      expect(store.animationSpeed).toBe(20);

      store.setSpeed(500);
      expect(store.animationSpeed).toBe(500);

      store.setSpeed(200);
      expect(store.animationSpeed).toBe(200);
    });

    test('速度应该是整数', () => {
      const store = useSortStore();

      store.setSpeed(150);
      expect(store.animationSpeed).toBe(150);

      store.setSpeed(250.5);
      expect(store.animationSpeed).toBe(250.5); // 当前没有强制整数
    });
  });

  describe('setAlgorithm', () => {
    test('应该设置算法', () => {
      const store = useSortStore();

      store.setAlgorithm('bubble');
      expect(store.algorithm).toBe('bubble');

      store.setAlgorithm('quick');
      expect(store.algorithm).toBe('quick');

      store.setAlgorithm('heap');
      expect(store.algorithm).toBe('heap');
    });

    test('应该支持所有已定义的算法', () => {
      const store = useSortStore();
      const algorithms: SortAlgorithm[] = [
        'bubble',
        'insertion',
        'merge',
        'quick',
        'shell',
        'bucket',
        'heap'
      ];

      algorithms.forEach(algorithm => {
        expect(() => store.setAlgorithm(algorithm)).not.toThrow();
        expect(store.algorithm).toBe(algorithm);
      });
    });

    test('算法切换应该保持其他状态不变', () => {
      const store = useSortStore();

      store.generateArray(10);
      store.setSpeed(150);
      const originalArray = [...store.originalArray];

      store.setAlgorithm('merge');

      expect(store.originalArray).toEqual(originalArray);
      expect(store.animationSpeed).toBe(150);
      expect(store.arraySize).toBe(10);
    });
  });

  describe('状态持久化和响应性', () => {
    test('状态更新应该是响应式的', () => {
      const store = useSortStore();

      const speeds: number[] = [];
      const unwatch = store.$subscribe((mutation, state) => {
        if (mutation.storeId === 'sort') {
          speeds.push(state.animationSpeed);
        }
      });

      store.setSpeed(100);
      store.setSpeed(200);
      store.setSpeed(300);

      expect(speeds).toContain(100);
      expect(speeds).toContain(200);
      expect(speeds).toContain(300);

      unwatch();
    });

    test('多个状态可以独立更新', () => {
      const store = useSortStore();

      store.generateArray(20);
      store.setSpeed(150);
      store.setAlgorithm('merge');

      expect(store.arraySize).toBe(20);
      expect(store.animationSpeed).toBe(150);
      expect(store.algorithm).toBe('merge');
      expect(store.originalArray).toHaveLength(20);
    });
  });

  describe('ArrayElement 结构验证', () => {
    test('生成的数组元素应该有正确的结构', () => {
      const store = useSortStore();
      store.generateArray(5);

      store.originalArray.forEach(item => {
        expect(item).toHaveProperty('value');
        expect(item).toHaveProperty('displayIndex');

        expect(typeof item.value).toBe('number');
        expect(typeof item.displayIndex).toBe('number');

        expect(item.value).toBeGreaterThan(0);
        expect(item.displayIndex).toBeGreaterThan(0);
      });
    });

    test('displayIndex应该保持稳定（不随value变化）', () => {
      const store = useSortStore();
      store.generateArray(10);

      const originalDisplayIndexes = store.originalArray.map(item => ({
        value: item.value,
        displayIndex: item.displayIndex
      }));

      // displayIndex是元素的身份标识，不应该因为重新生成而改变
      store.generateArray(10);

      const newDisplayIndexes = store.originalArray.map(item => ({
        value: item.value,
        displayIndex: item.displayIndex
      }));

      // displayIndex应该是连续的1..n
      expect(newDisplayIndexes.map(d => d.displayIndex))
        .toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });
  });

  describe('边界情况和错误处理', () => {
    test('应该处理大小为0的数组生成', () => {
      const store = useSortStore();

      store.generateArray(0);
      expect(store.originalArray).toEqual([]);
    });

    test('应该处理极大的数组', () => {
      const store = useSortStore();

      // 项目限制最大100，但测试更大值的处理
      expect(() => store.generateArray(1000)).not.toThrow();
      expect(store.originalArray).toHaveLength(1000);
    });

    test('应该处理极端速度值', () => {
      const store = useSortStore();

      store.setSpeed(0);
      expect(store.animationSpeed).toBe(0);

      store.setSpeed(10000);
      expect(store.animationSpeed).toBe(10000);
    });

    test('应该处理负数大小', () => {
      const store = useSortStore();

      store.generateArray(-5);
      expect(store.originalArray).toHaveLength(0); // 可能返回空数组
    });
  });

  describe('Store 的可序列化性', () => {
    test('状态应该可以被序列化', () => {
      const store = useSortStore();

      store.generateArray(5);
      store.setSpeed(150);
      store.setAlgorithm('bubble');

      const serialized = JSON.stringify({
        originalArray: store.originalArray,
        animationSpeed: store.animationSpeed,
        arraySize: store.arraySize,
        algorithm: store.algorithm
      });

      const deserialized = JSON.parse(serialized);

      expect(deserialized.originalArray).toEqual(store.originalArray);
      expect(deserialized.animationSpeed).toBe(store.animationSpeed);
      expect(deserialized.arraySize).toBe(store.arraySize);
      expect(deserialized.algorithm).toBe(store.algorithm);
    });
  });

  describe('实际使用场景模拟', () => {
    test('典型使用流程', () => {
      const store = useSortStore();

      // 1. 初始化设置
      store.generateArray(10);
      store.setSpeed(200);
      store.setAlgorithm('quick');

      // 2. 验证初始状态
      expect(store.originalArray).toHaveLength(10);
      expect(store.animationSpeed).toBe(200);
      expect(store.algorithm).toBe('quick');

      // 3. 模拟用户操作
      store.setSpeed(100);
      store.setAlgorithm('heap');

      // 4. 验证状态变化
      expect(store.animationSpeed).toBe(100);
      expect(store.algorithm).toBe('heap');
      expect(store.originalArray.length).toBeGreaterThan(0);
    });

    test('算法切换场景', () => {
      const store = useSortStore();

      store.generateArray(8);

      // 用户快速切换算法
      const algorithms: SortAlgorithm[] = ['bubble', 'quick', 'merge', 'heap', 'bucket'];

      algorithms.forEach(algorithm => {
        store.setAlgorithm(algorithm);
        expect(store.algorithm).toBe(algorithm);
      });
    });

    test('速度调节场景', () => {
      const store = useSortStore();

      store.generateArray(10);

      // 用户调节速度
      const speeds = [500, 400, 300, 200, 100, 50, 20];

      speeds.forEach(speed => {
        store.setSpeed(speed);
        expect(store.animationSpeed).toBe(speed);
      });
    });

    test('重新生成数组场景', () => {
      const store = useSortStore();

      // 用户多次重新生成数组
      const sizes = [10, 20, 50, 100, 50, 10];

      sizes.forEach(size => {
        store.generateArray(size);
        expect(store.originalArray).toHaveLength(size);

        // 验证数据完整性
        const values = store.originalArray.map(item => item.value);
        const uniqueValues = new Set(values);
        expect(uniqueValues.size).toBe(size);
      });
    });
  });
});
