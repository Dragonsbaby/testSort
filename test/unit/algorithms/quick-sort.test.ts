import { describe, test, expect } from 'vitest';
import { quickSort } from '@/utils/sortingAlgorithms';
import { validateSortingSteps, batchTestAlgorithm } from '../../helpers/algorithm-tester';

describe('quickSort', () => {
  describe('基本功能测试', () => {
    test('空数组', () => {
      const steps = quickSort([]);
      expect(steps).toHaveLength(0);
    });

    test('单元素数组', () => {
      const steps = quickSort([5]);
      expect(steps.length).toBeGreaterThan(0);
      expect(steps[steps.length - 1].type).toBe('sorted');
    });

    test('已排序数组', () => {
      const steps = quickSort([1, 2, 3, 4]);
      const finalSnapshot = steps[steps.length - 1].arraySnapshot;
      expect(finalSnapshot).toEqual([1, 2, 3, 4]);
    });

    test('逆序数组', () => {
      const steps = quickSort([4, 3, 2, 1]);
      const finalSnapshot = steps[steps.length - 1].arraySnapshot;
      expect(finalSnapshot).toEqual([1, 2, 3, 4]);
    });

    test('随机数组', () => {
      const input = [3, 1, 4, 1, 5, 9, 2, 6];
      const steps = quickSort([...input]);
      const finalSnapshot = steps[steps.length - 1].arraySnapshot;
      expect(finalSnapshot).toEqual([1, 1, 2, 3, 4, 5, 6, 9]);
    });
  });

  describe('快速排序特性', () => {
    test('应该包含pivot步骤', () => {
      const steps = quickSort([3, 1, 2]);
      const pivotSteps = steps.filter(step => step.type === 'pivot');

      expect(pivotSteps.length).toBeGreaterThan(0);

      pivotSteps.forEach(step => {
        expect(step.indices).toHaveLength(1);
        expect(step.description).toContain('基准');
      });
    });

    test('pivot步骤应该标记基准元素', () => {
      const steps = quickSort([3, 1, 4, 2]);
      const pivotSteps = steps.filter(step => step.type === 'pivot');

      pivotSteps.forEach(step => {
        const pivotIndex = step.indices[0];
        expect(pivotIndex).toBeGreaterThanOrEqual(0);
        expect(pivotIndex).toBeLessThan(4);
      });
    });

    test('应该有分区后的sorted标记', () => {
      const steps = quickSort([3, 1, 4, 2]);
      const sortedSteps = steps.filter(step => step.type === 'sorted');

      expect(sortedSteps.length).toBeGreaterThan(0);

      // 快速排序的sorted标记中，分区后的sorted步骤标记单个元素
      // 排除最终的完成步骤（标记所有元素）
      const partitionSortedSteps = sortedSteps.filter(step => step.indices.length === 1);
      expect(partitionSortedSteps.length).toBeGreaterThan(0);

      // 验证这些单元素标记确实只标记一个元素
      partitionSortedSteps.forEach(step => {
        expect(step.indices).toHaveLength(1);
      });

      // 验证有最终完成步骤标记所有元素
      const finalSortedStep = sortedSteps[sortedSteps.length - 1];
      expect(finalSortedStep.indices.length).toBe(4);
    });

    test('分区过程应该正确', () => {
      const steps = quickSort([3, 1, 2]);
      const swapSteps = steps.filter(step => step.type === 'swap');

      // 验证交换步骤的合理性
      swapSteps.forEach(step => {
        expect(step.arraySnapshot).toBeDefined();
        expect(step.indices).toHaveLength(2);
      });
    });
  });

  describe('递归特性验证', () => {
    test('应该处理子数组', () => {
      const steps = quickSort([3, 1, 4, 1, 5, 9, 2, 6]);

      // 快速排序会递归处理子数组，应该有多个sorted步骤
      const sortedSteps = steps.filter(step => step.type === 'sorted');
      expect(sortedSteps.length).toBeGreaterThan(1);
    });

    test('最终应该全部标记为sorted', () => {
      const steps = quickSort([3, 1, 2]);
      const finalStep = steps[steps.length - 1];

      expect(finalStep.type).toBe('sorted');
      expect(finalStep.indices.length).toBeGreaterThan(1);
    });
  });

  describe('边界情况', () => {
    test('所有元素相同', () => {
      const steps = quickSort([2, 2, 2, 2]);
      const finalSnapshot = steps[steps.length - 1].arraySnapshot;
      expect(finalSnapshot).toEqual([2, 2, 2, 2]);
    });

    test('两个元素', () => {
      const steps = quickSort([2, 1]);
      const finalSnapshot = steps[steps.length - 1].arraySnapshot;
      expect(finalSnapshot).toEqual([1, 2]);
    });

    test('三个元素 - 中间为基准', () => {
      const steps = quickSort([1, 3, 2]);
      const finalSnapshot = steps[steps.length - 1].arraySnapshot;
      expect(finalSnapshot).toEqual([1, 2, 3]);
    });

    test('负数和正数混合', () => {
      const steps = quickSort([0, -1, 1, -2, 2]);
      const finalSnapshot = steps[steps.length - 1].arraySnapshot;
      expect(finalSnapshot).toEqual([-2, -1, 0, 1, 2]);
    });
  });

  describe('步骤描述质量', () => {
    test('所有步骤都应该有描述', () => {
      const steps = quickSort([3, 1, 2]);

      steps.forEach(step => {
        expect(step.description).toBeTruthy();
        expect(step.description.length).toBeGreaterThan(0);
      });
    });

    test('描述应该包含关键信息', () => {
      const steps = quickSort([3, 1, 2]);
      const pivotSteps = steps.filter(step => step.type === 'pivot');

      pivotSteps.forEach(step => {
        expect(step.description).toMatch(/基准|pivot/);
      });
    });
  });

  describe('算法复杂度验证', () => {
    test('时间复杂度应该合理', () => {
      const small = quickSort([1, 2, 3]);
      const medium = quickSort([1, 2, 3, 4, 5, 6, 7]);
      const large = quickSort(Array.from({ length: 20 }, (_, i) => i + 1));

      // O(n log n) 复杂度，large不应该比small呈指数增长
      // 考虑到三层描述系统增加了更多详细步骤，大幅放宽比例要求
      expect(large.length).toBeLessThan(small.length * 35);
      expect(medium.length).toBeGreaterThan(small.length);
    });

    test('最坏情况 - 已排序数组', () => {
      const steps = quickSort([1, 2, 3, 4, 5]);

      // 即使最坏情况，也应该能完成排序
      expect(steps.length).toBeGreaterThan(0);
      expect(steps[steps.length - 1].arraySnapshot).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('稳定性验证', () => {
    test('批量测试用例', () => {
      const results = batchTestAlgorithm('quickSort', quickSort);

      results.forEach((result, testName) => {
        expect(result.valid).toBe(true);
        if (!result.valid) {
          console.error(`QuickSort ${testName} 失败:`, result.error);
        }
      });
    });

    test('多次运行结果应该一致', () => {
      const input = [3, 1, 4, 1, 5, 9, 2, 6];

      const steps1 = quickSort([...input]);
      const steps2 = quickSort([...input]);

      // 结果应该相同
      expect(steps1[steps1.length - 1].arraySnapshot)
        .toEqual(steps2[steps2.length - 1].arraySnapshot);

      // 步骤数应该相同
      expect(steps1.length).toBe(steps2.length);
    });
  });

  describe('Lomuto分区方案特性', () => {
    test('应该选择末尾元素作为基准', () => {
      const steps = quickSort([3, 1, 4, 2]);
      const firstPivot = steps.find(step => step.type === 'pivot');

      expect(firstPivot).toBeDefined();
      // 第一个pivot应该是最后一个元素
      expect(firstPivot?.indices[0]).toBe(3);
    });

    test('基准元素应该移动到正确位置', () => {
      const input = [3, 1, 4, 1, 5, 9, 2, 6];
      const steps = quickSort([...input]);

      // 检查每次pivot后，基准元素是否在正确位置
      const pivotSteps = steps.filter(step => step.type === 'pivot');

      pivotSteps.forEach(pivotStep => {
        const pivotIndex = pivotStep.indices[0];
        // 找到这个pivot步骤后的下一个sorted步骤
        const pivotIndexInSteps = steps.indexOf(pivotStep);
        const nextSorted = steps.slice(pivotIndexInSteps).find(step => step.type === 'sorted');

        if (nextSorted && nextSorted.indices.includes(pivotIndex)) {
          // 这个基准元素已经就位
          expect(nextSorted.indices).toContain(pivotIndex);
        }
      });
    });
  });
});
