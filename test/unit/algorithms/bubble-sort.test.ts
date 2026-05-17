import { describe, test, expect } from 'vitest';
import { bubbleSort } from '@/utils/sortingAlgorithms';
import { validateSortingSteps } from '../../helpers/algorithm-tester';

describe('bubbleSort', () => {
  describe('基本功能测试', () => {
    test('空数组', () => {
      const steps = bubbleSort([]);
      expect(steps).toHaveLength(0);
    });

    test('单元素数组', () => {
      const steps = bubbleSort([5]);
      expect(steps.length).toBeGreaterThan(0);
      // 单元素应该直接完成排序
      expect(steps[steps.length - 1].type).toBe('sorted');
    });

    test('已排序数组', () => {
      const steps = bubbleSort([1, 2, 3, 4]);
      const finalSnapshot = steps[steps.length - 1].arraySnapshot;
      expect(finalSnapshot).toEqual([1, 2, 3, 4]);
    });

    test('逆序数组', () => {
      const steps = bubbleSort([4, 3, 2, 1]);
      const finalSnapshot = steps[steps.length - 1].arraySnapshot;
      expect(finalSnapshot).toEqual([1, 2, 3, 4]);
    });

    test('随机数组', () => {
      const input = [3, 1, 4, 1, 5, 9, 2, 6];
      const steps = bubbleSort([...input]);
      const finalSnapshot = steps[steps.length - 1].arraySnapshot;
      expect(finalSnapshot).toEqual([1, 1, 2, 3, 4, 5, 6, 9]);
    });
  });

  describe('步骤验证', () => {
    test('应该包含必要的步骤类型', () => {
      const steps = bubbleSort([3, 1, 2]);
      const stepTypes = new Set(steps.map(step => step.type));

      // 冒泡排序应该包含这些步骤类型
      expect(stepTypes).toContain('compare');
      expect(stepTypes).toContain('sorted');
    });

    test('比较步骤应该有两个索引', () => {
      const steps = bubbleSort([3, 1, 2]);
      const compareSteps = steps.filter(step => step.type === 'compare');

      compareSteps.forEach(step => {
        expect(step.indices).toHaveLength(2);
        expect(step.indices[0]).toBeGreaterThanOrEqual(0);
        expect(step.indices[1]).toBeGreaterThanOrEqual(0);
      });
    });

    test('交换步骤应该正确更新数组', () => {
      const steps = bubbleSort([3, 2, 1]);
      const swapSteps = steps.filter(step => step.type === 'swap');

      expect(swapSteps.length).toBeGreaterThan(0);

      swapSteps.forEach(step => {
        expect(step.arraySnapshot).toBeDefined();
        expect(step.indices).toHaveLength(2);
      });
    });

    test('最后一步应该是sorted', () => {
      const steps = bubbleSort([3, 1, 2]);
      expect(steps[steps.length - 1].type).toBe('sorted');
    });
  });

  describe('边界情况', () => {
    test('重复元素', () => {
      const steps = bubbleSort([2, 2, 1, 1]);
      const finalSnapshot = steps[steps.length - 1].arraySnapshot;
      expect(finalSnapshot).toEqual([1, 1, 2, 2]);
    });

    test('负数', () => {
      const steps = bubbleSort([-3, -1, -2]);
      const finalSnapshot = steps[steps.length - 1].arraySnapshot;
      expect(finalSnapshot).toEqual([-3, -2, -1]);
    });

    test('混合正负数', () => {
      const steps = bubbleSort([0, -1, 1, -2]);
      const finalSnapshot = steps[steps.length - 1].arraySnapshot;
      expect(finalSnapshot).toEqual([-2, -1, 0, 1]);
    });
  });

  describe('算法特性', () => {
    test('应该从右到左逐步标记已排序', () => {
      const steps = bubbleSort([3, 2, 1]);
      const sortedSteps = steps.filter(step => step.type === 'sorted');

      // 冒泡排序从右到左逐步排序
      expect(sortedSteps.length).toBeGreaterThan(0);

      // 检查sorted索引是否从末尾开始
      const sortedIndices = sortedSteps.map(step => step.indices[0]);
      expect(sortedIndices).toContain(2); // 最右边元素
    });

    test('步骤描述应该清晰', () => {
      const steps = bubbleSort([3, 1, 2]);

      steps.forEach(step => {
        expect(step.description).toBeTruthy();
        expect(step.description.length).toBeGreaterThan(0);
        // 验证使用标准位置描述而不是变量名泄露
        expect(step.description).toMatch(/位置 \d+/);
        expect(step.description).not.toContain(/arr\[/);
      });
    });
  });

  describe('性能特性', () => {
    test('小数组步骤数合理', () => {
      const steps = bubbleSort([3, 1, 2]);
      // 对于3个元素，步骤数应该在合理范围内
      expect(steps.length).toBeLessThan(50);
    });

    test('步骤数与数组规模关系', () => {
      const small = bubbleSort([1, 2, 3]);
      const medium = bubbleSort([1, 2, 3, 4, 5]);

      // 更大的数组应该产生更多步骤
      expect(medium.length).toBeGreaterThan(small.length);
    });
  });

  describe('稳定性验证', () => {
    test('使用通用算法验证器', () => {
      const testCases = [
        [],
        [1],
        [1, 2, 3],
        [3, 2, 1],
        [5, 2, 8, 1, 9],
        [3, 1, 4, 1, 5, 9, 2, 6]
      ];

      testCases.forEach((input, index) => {
        const steps = bubbleSort([...input]);
        const validation = validateSortingSteps(input, steps);

        if (!validation.valid) {
          console.error(`测试用例 ${index + 1}: 输入 [${input.join(', ')}]`);
          console.error(`冒泡排序验证失败: ${validation.error}`);
          console.error(`生成的步骤数: ${steps.length}`);

          // 打印前3个步骤的详细信息
          console.error('前3个步骤:');
          for (let i = 0; i < Math.min(3, steps.length); i++) {
            const step = steps[i];
            console.error(`  步骤${i}: type=${step.type}, indices=[${step.indices.join(',')}]`);
            if (step.arraySnapshot) {
              console.error(`    快照: [${step.arraySnapshot.join(', ')}]`);
            } else {
              console.error(`    快照: 无`);
            }
          }
        }

        expect(validation.valid).toBe(true);
      });
    });
  });
});
