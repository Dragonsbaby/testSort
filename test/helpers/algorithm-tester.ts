/**
 * 算法测试辅助工具
 * 提供通用的排序算法验证功能
 */

import type { SemanticStep } from '@/types/timeline';

export interface SortingValidationResult {
  valid: boolean;
  error?: string;
  stats?: {
    totalSteps: number;
    comparisons: number;
    swaps: number;
    sortedCount: number;
  };
}

/**
 * 验证排序算法步骤的正确性
 */
export function validateSortingSteps(
  input: number[],
  steps: SemanticStep[]
): SortingValidationResult {
  if (input.length === 0) {
    return { valid: steps.length === 0 };
  }

  // 1. 检查是否有步骤
  if (steps.length === 0) {
    return { valid: false, error: '没有生成任何步骤' };
  }

  // 2. 检查最后一步是否为sorted
  const lastStep = steps[steps.length - 1];
  if (lastStep.type !== 'sorted') {
    return { valid: false, error: '最后一步不是sorted状态' };
  }

  // 3. 检查最终结果是否正确排序
  const finalSnapshot = lastStep.arraySnapshot;
  if (!finalSnapshot) {
    return { valid: false, error: '最后一步缺少数组快照' };
  }

  const expectedSorted = [...input].sort((a, b) => a - b);
  if (!arraysEqual(finalSnapshot, expectedSorted)) {
    return {
      valid: false,
      error: `排序结果不正确。期望: ${expectedSorted.join(', ')}, 实际: ${finalSnapshot.join(', ')}`
    };
  }

  // 4. 验证步骤的一致性
  let currentArray = [...input];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];

    // 验证索引范围
    for (const idx of step.indices) {
      if (idx < 0 || idx >= currentArray.length) {
        return {
          valid: false,
          error: `步骤 ${i}: 索引 ${idx} 超出范围 [0, ${currentArray.length - 1}]`
        };
      }
    }

    // 如果步骤有快照，验证快照一致性
    if (step.arraySnapshot) {
      if (!arraysEqual(step.arraySnapshot, currentArray)) {
        return {
          valid: false,
          error: `步骤 ${i}: 数组快照与当前状态不匹配`
        };
      }
      // 更新当前数组状态（对于swap等操作）
      currentArray = [...step.arraySnapshot];
    }
  }

  // 5. 统计步骤信息
  const stats = {
    totalSteps: steps.length,
    comparisons: steps.filter(s => s.type === 'compare').length,
    swaps: steps.filter(s => s.type === 'swap').length,
    sortedCount: steps.filter(s => s.type === 'sorted').length
  };

  return { valid: true, stats };
}

/**
 * 比较两个数组是否相等
 */
function arraysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * 性能测试助手
 */
export function measureAlgorithmPerformance(
  algorithm: (arr: number[]) => SemanticStep[],
  input: number[],
  iterations = 10
) {
  const times: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    algorithm([...input]);
    const end = performance.now();
    times.push(end - start);
  }

  return {
    avgTime: times.reduce((a, b) => a + b, 0) / iterations,
    minTime: Math.min(...times),
    maxTime: Math.max(...times),
    medianTime: times.sort((a, b) => a - b)[Math.floor(times.length / 2)]
  };
}

/**
 * 生成测试用例
 */
export const TEST_CASES = {
  empty: [] as number[],
  single: [1] as number[],
  sorted: [1, 2, 3, 4, 5] as number[],
  reversed: [5, 4, 3, 2, 1] as number[],
  random: [3, 1, 4, 1, 5, 9, 2, 6, 5, 3] as number[],
  duplicates: [2, 2, 1, 1, 3, 3] as number[],
  negative: [-3, -1, -2, -4] as number[],
  mixed: [0, -1, 1, -2, 2] as number[],
  large: Array.from({ length: 100 }, () => Math.floor(Math.random() * 100)) as number[]
};

/**
 * 批量测试算法
 */
export function batchTestAlgorithm(
  algorithmName: string,
  algorithm: (arr: number[]) => SemanticStep[]
): Map<string, SortingValidationResult> {
  const results = new Map<string, SortingValidationResult>();

  Object.entries(TEST_CASES).forEach(([name, input]) => {
    const steps = algorithm([...input]);
    const validation = validateSortingSteps(input, steps);
    results.set(name, validation);

    if (!validation.valid) {
      console.error(`${algorithmName} - ${name} 测试失败:`, validation.error);
    }
  });

  return results;
}
