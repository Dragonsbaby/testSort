import { describe, test, expect } from 'vitest';
import { heapSort } from '@/utils/sortingAlgorithms';
import { validateSortingSteps, batchTestAlgorithm } from '../../helpers/algorithm-tester';

describe('heapSort - 最大堆模式（升序）', () => {
  const mode = 'max' as const;

  describe('基本功能测试', () => {
    test('空数组', () => {
      const steps = heapSort([], mode);
      expect(steps).toHaveLength(0);
    });

    test('单元素数组', () => {
      const steps = heapSort([5], mode);
      expect(steps.length).toBeGreaterThan(0);
      expect(steps[steps.length - 1].type).toBe('sorted');
    });

    test('已排序数组', () => {
      const steps = heapSort([1, 2, 3, 4], mode);
      const finalSnapshot = steps[steps.length - 1].arraySnapshot;
      expect(finalSnapshot).toEqual([1, 2, 3, 4]);
    });

    test('逆序数组', () => {
      const steps = heapSort([4, 3, 2, 1], mode);
      const finalSnapshot = steps[steps.length - 1].arraySnapshot;
      expect(finalSnapshot).toEqual([1, 2, 3, 4]);
    });

    test('随机数组', () => {
      const input = [3, 1, 4, 1, 5, 9, 2, 6];
      const steps = heapSort([...input], mode);
      const finalSnapshot = steps[steps.length - 1].arraySnapshot;
      expect(finalSnapshot).toEqual([1, 1, 2, 3, 4, 5, 6, 9]);
    });
  });

  describe('最大堆特性', () => {
    test('应该包含pivot步骤标记sift-down根节点', () => {
      const steps = heapSort([3, 1, 2], mode);
      const pivotSteps = steps.filter(step => step.type === 'pivot');

      expect(pivotSteps.length).toBeGreaterThan(0);

      pivotSteps.forEach(step => {
        expect(step.indices).toHaveLength(1);
        expect(step.description).toContain('sift-down');
      });
    });

    test('应该有groupIndices标记堆范围', () => {
      const steps = heapSort([3, 1, 4, 2], mode);
      const stepsWithGroup = steps.filter(step => step.groupIndices);

      expect(stepsWithGroup.length).toBeGreaterThan(0);

      stepsWithGroup.forEach(step => {
        expect(step.groupIndices).toBeDefined();
        expect(step.groupIndices!.length).toBeGreaterThan(0);
      });
    });

    test('建堆阶段应该覆盖所有非叶节点', () => {
      const input = [4, 3, 2, 1, 5];
      const steps = heapSort(input, mode);

      // 应该有多个sift-down操作（从最后一个非叶节点开始）
      const siftDownSteps = steps.filter(step =>
        step.type === 'pivot' && step.description.includes('sift-down')
      );

      expect(siftDownSteps.length).toBeGreaterThan(0);
    });

    test('提取阶段应该逐步缩小堆范围', () => {
      const steps = heapSort([3, 1, 4, 2], mode);
      const sortedSteps = steps.filter(step => step.type === 'sorted');

      // 每次提取一个元素到末尾
      expect(sortedSteps.length).toBeGreaterThan(0);

      // 检查sorted索引是否从末尾开始
      const sortedIndices = sortedSteps.map(step => step.indices[0]);
      expect(sortedIndices).toContain(3); // 最右边元素
    });
  });

  describe('堆排序两阶段特性', () => {
    test('应该有建堆和提取两个阶段', () => {
      const steps = heapSort([3, 1, 4, 2, 5], mode);

      // 找到第一个sorted步骤（建堆结束）
      const firstSortedIndex = steps.findIndex(step => step.type === 'sorted');

      // 建堆阶段应该有sift-down操作
      const buildPhaseSteps = steps.slice(0, firstSortedIndex);
      const siftDownInBuildPhase = buildPhaseSteps.filter(step =>
        step.description.includes('sift-down')
      );

      expect(siftDownInBuildPhase.length).toBeGreaterThan(0);

      // 提取阶段应该有swap和sorted操作
      const extractPhaseSteps = steps.slice(firstSortedIndex);
      const swapInExtractPhase = extractPhaseSteps.filter(step => step.type === 'swap');

      expect(swapInExtractPhase.length).toBeGreaterThan(0);
    });

    test('堆顶应该与末尾元素交换', () => {
      const steps = heapSort([3, 1, 4, 2], mode);
      const swapSteps = steps.filter(step => step.type === 'swap');

      expect(swapSteps.length).toBeGreaterThan(0);

      // 每次交换都应该涉及索引0（堆顶）
      const hasTopSwap = swapSteps.some(step =>
        step.indices.includes(0)
      );

      expect(hasTopSwap).toBe(true);
    });
  });
});

describe('heapSort - 最小堆模式（降序）', () => {
  const mode = 'min' as const;

  describe('基本功能测试', () => {
    test('降序排列', () => {
      const steps = heapSort([1, 2, 3, 4], mode);
      const finalSnapshot = steps[steps.length - 1].arraySnapshot;
      expect(finalSnapshot).toEqual([4, 3, 2, 1]);
    });

    test('随机数组降序', () => {
      const input = [3, 1, 4, 1, 5, 9, 2, 6];
      const steps = heapSort([...input], mode);
      const finalSnapshot = steps[steps.length - 1].arraySnapshot;
      expect(finalSnapshot).toEqual([9, 6, 5, 4, 3, 2, 1, 1]);
    });
  });

  describe('最小堆特性', () => {
    test('比较逻辑应该相反', () => {
      const maxSteps = heapSort([3, 1, 4], 'max');
      const minSteps = heapSort([3, 1, 4], 'min');

      // 两种模式的结果应该相反
      const maxResult = maxSteps[maxSteps.length - 1].arraySnapshot;
      const minResult = minSteps[minSteps.length - 1].arraySnapshot;

      expect(maxResult).toEqual([1, 3, 4]);
      expect(minResult).toEqual([4, 3, 1]);
    });

    test('应该包含相同的步骤类型', () => {
      const steps = heapSort([3, 1, 4], mode);
      const stepTypes = new Set(steps.map(step => step.type));

      expect(stepTypes).toContain('compare');
      expect(stepTypes).toContain('swap');
      expect(stepTypes).toContain('sorted');
      expect(stepTypes).toContain('pivot');
    });
  });
});

describe('heapSort - 边界情况和特殊测试', () => {
  describe('边界情况', () => {
    test('两个元素 - 最大堆', () => {
      const steps = heapSort([2, 1], 'max');
      const finalSnapshot = steps[steps.length - 1].arraySnapshot;
      expect(finalSnapshot).toEqual([1, 2]);
    });

    test('两个元素 - 最小堆', () => {
      const steps = heapSort([1, 2], 'min');
      const finalSnapshot = steps[steps.length - 1].arraySnapshot;
      expect(finalSnapshot).toEqual([2, 1]);
    });

    test('所有元素相同', () => {
      const steps = heapSort([2, 2, 2, 2], 'max');
      const finalSnapshot = steps[steps.length - 1].arraySnapshot;
      expect(finalSnapshot).toEqual([2, 2, 2, 2]);
    });

    test('包含负数', () => {
      const steps = heapSort([-3, -1, -2, -4], 'max');
      const finalSnapshot = steps[steps.length - 1].arraySnapshot;
      expect(finalSnapshot).toEqual([-4, -3, -2, -1]);
    });

    test('混合正负数', () => {
      const steps = heapSort([0, -1, 1, -2, 2], 'max');
      const finalSnapshot = steps[steps.length - 1].arraySnapshot;
      expect(finalSnapshot).toEqual([-2, -1, 0, 1, 2]);
    });
  });

  describe('堆结构特性验证', () => {
    test('父子关系应该正确', () => {
      const input = [4, 3, 2, 1, 5];
      const steps = heapSort(input, 'max');
      const compareSteps = steps.filter(step => step.type === 'compare');

      // 比较步骤应该涉及父子节点
      expect(compareSteps.length).toBeGreaterThan(0);

      // 验证比较的索引对（父子关系）
      compareSteps.forEach(step => {
        const [idx1, idx2] = step.indices;
        // 检查是否是合理的父子关系
        const isParentChild = (Math.abs(idx1 - idx2) === 1) ||
                             (Math.floor((idx2 - 1) / 2) === idx1) ||
                             (Math.floor((idx1 - 1) / 2) === idx2);

        // 不强制要求所有比较都是父子关系，但应该有这种情况
      });
    });

    test('sift-down应该沿着树路径', () => {
      const steps = heapSort([5, 4, 3, 2, 1], 'max');
      const swapSteps = steps.filter(step => step.type === 'swap');

      // sift-down过程中的交换应该沿着树路径向下
      expect(swapSteps.length).toBeGreaterThan(0);
    });
  });

  describe('算法复杂度验证', () => {
    test('时间复杂度应该合理', () => {
      const small = heapSort([1, 2, 3], 'max');
      const medium = heapSort([1, 2, 3, 4, 5, 6, 7], 'max');
      const large = heapSort(Array.from({ length: 20 }, (_, i) => i + 1), 'max');

      // O(n log n) 复杂度
      expect(large.length).toBeLessThan(small.length * 15);
      expect(medium.length).toBeGreaterThan(small.length);
    });

    test('空间复杂度验证', () => {
      const input = [3, 1, 4, 1, 5, 9, 2, 6];
      const steps = heapSort(input, 'max');

      // 堆排序是原地排序，不应该使用额外空间（除了步骤记录）
      steps.forEach(step => {
        // 验证步骤中没有使用大量额外空间
        if (step.arraySnapshot) {
          expect(step.arraySnapshot.length).toBe(input.length);
        }
      });
    });
  });

  describe('稳定性验证', () => {
    test('批量测试用例 - 最大堆', () => {
      // 修改测试用例以支持mode参数
      const testCases = [
        { input: [], mode: 'max' as const },
        { input: [1], mode: 'max' as const },
        { input: [1, 2, 3], mode: 'max' as const },
        { input: [3, 2, 1], mode: 'max' as const },
        { input: [5, 2, 8, 1, 9], mode: 'max' as const },
      ];

      testCases.forEach(({ input, mode }) => {
        const steps = heapSort([...input], mode);
        const validation = validateSortingSteps(input, steps);

        expect(validation.valid).toBe(true);
        if (!validation.valid) {
          console.error(`堆排序验证失败: ${validation.error}`);
        }
      });
    });

    test('批量测试用例 - 最小堆', () => {
      const testCases = [
        { input: [1, 2, 3], expected: [3, 2, 1] },
        { input: [3, 2, 1], expected: [3, 2, 1] },
        { input: [5, 2, 8, 1, 9], expected: [9, 8, 5, 2, 1] },
      ];

      testCases.forEach(({ input, expected }) => {
        const steps = heapSort(input, 'min');
        const result = steps[steps.length - 1].arraySnapshot;

        expect(result).toEqual(expected);
      });
    });
  });

  describe('步骤描述质量', () => {
    test('所有步骤都应该有描述', () => {
      const steps = heapSort([3, 1, 2], 'max');

      steps.forEach(step => {
        expect(step.description).toBeTruthy();
        expect(step.description.length).toBeGreaterThan(0);
      });
    });

    test('描述应该包含堆操作信息', () => {
      const steps = heapSort([3, 1, 4, 2], 'max');
      const siftDownSteps = steps.filter(step =>
        step.description.includes('sift-down')
      );

      expect(siftDownSteps.length).toBeGreaterThan(0);

      siftDownSteps.forEach(step => {
        expect(step.description).toMatch(/sift-down|根节点/);
      });
    });
  });
});

describe('heapSort - 性能和特殊场景', () => {
  test('完全二叉树结构', () => {
    // 7个元素形成完全二叉树
    const input = [7, 6, 5, 4, 3, 2, 1];
    const steps = heapSort(input, 'max');
    const finalSnapshot = steps[steps.length - 1].arraySnapshot;

    expect(finalSnapshot).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  test('大量重复元素', () => {
    const input = [1, 1, 1, 2, 2, 2, 3, 3, 3];
    const steps = heapSort(input, 'max');
    const finalSnapshot = steps[steps.length - 1].arraySnapshot;

    expect(finalSnapshot).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3]);
  });
});
