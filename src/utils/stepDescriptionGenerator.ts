import type { SortAlgorithm } from '@/types/sorting';
import type { EnhancedDescription } from '@/types/enhanced-step';
import type { StepContext } from '@/types/timeline';
import {
  REGION_TERMS,
  OPERATION_TERMS,
  PHASE_TERMS,
  normalizePosition,
  normalizeCompare
} from './terminology-standards';

/**
 * 统一描述生成器
 * 为排序算法的每个步骤生成三层描述（简洁、详细、上下文）
 */
export class StepDescriptionGenerator {
  private algorithm: SortAlgorithm;
  private currentDepth: number = 0;
  private currentPhase: string = '';
  private totalSteps: number = 0;
  private currentStep: number = 0;

  constructor(algorithm: SortAlgorithm, totalSteps?: number) {
    this.algorithm = algorithm;
    if (totalSteps) {
      this.totalSteps = totalSteps;
    }
  }

  /** 更新当前深度（用于递归算法） */
  setDepth(depth: number): void {
    this.currentDepth = depth;
  }

  /** 更新当前阶段 */
  setPhase(phase: string): void {
    this.currentPhase = phase;
  }

  /** 更新步骤计数 */
  updateStepCount(): void {
    this.currentStep++;
  }

  /** 获取当前进度百分比 */
  getProgress(): number {
    if (this.totalSteps === 0) return 0;
    return Math.floor((this.currentStep / this.totalSteps) * 100);
  }

  /**
   * 生成比较描述
   * @param indices 比较的索引位置
   * @param values 比较的值
   * @param extraContext 额外的上下文信息
   */
  generateCompare(
    indices: number[],
    values: number[],
    extraContext?: Partial<StepContext>
  ): EnhancedDescription {
    const [i, j] = indices;
    const [vi, vj] = values;
    const smaller = vi < vj ? vi : vj;
    const smallerIdx = vi < vj ? i : j;

    return {
      brief: normalizeCompare(i, vi, j, vj),
      detail: OPERATION_TERMS.compare.withPosition(i, vi, j, vj) + `，${normalizePosition(smallerIdx, smaller)}较小`,
      context: {
        phase: this.currentPhase || this.getPhase(),
        importance: 'medium',
        depth: this.currentDepth > 0 ? this.currentDepth : undefined,
        progress: this.totalSteps > 0 ? this.getProgress() : undefined,
        ...extraContext
      }
    };
  }

  /**
   * 生成交换描述
   * @param indices 交换的索引位置
   * @param values 交换的值
   * @param extraContext 额外的上下文信息
   */
  generateSwap(
    indices: number[],
    values: number[],
    extraContext?: Partial<StepContext>
  ): EnhancedDescription {
    const [i, j] = indices;
    const [vi, vj] = values;

    return {
      brief: `交换位置 ${i} 和 ${j}`,
      detail: OPERATION_TERMS.swap.moveToPosition(i, j, vi) + `，${OPERATION_TERMS.swap.moveToPosition(j, i, vj)}`,
      context: {
        hint: "交换操作让元素按正确的顺序排列",
        importance: 'high',
        phase: this.currentPhase || this.getPhase(),
        depth: this.currentDepth > 0 ? this.currentDepth : undefined,
        progress: this.totalSteps > 0 ? this.getProgress() : undefined,
        ...extraContext
      }
    };
  }

  /**
   * 生成基准描述（快速排序）
   * @param index 基准元素索引
   * @param value 基准元素值
   */
  generatePivot(index: number, value: number): EnhancedDescription {
    return {
      brief: `选择${normalizePosition(index, value)}作为基准元素`,
      detail: `基准元素 ${value} 将作为分界线，小于它的在左，大于它的在右`,
      context: {
        phase: PHASE_TERMS.quickSort.partition,
        hint: "基准选择是快速排序的关键，影响分区效率",
        importance: 'high',
        depth: this.currentDepth > 0 ? this.currentDepth : undefined
      }
    };
  }

  /**
   * 生成合并描述（归并排序）
   * @param left 左区间
   * @param mid 中点
   * @param right 右区间
   */
  generateMerge(left: number, mid: number, right: number): EnhancedDescription {
    return {
      brief: `合并区间 [${left}, ${mid}] 和 [${mid + 1}, ${right}]`,
      detail: `将两个有序子数组合并成一个有序区间，逐个比较并选择较小元素`,
      context: {
        phase: "合并阶段",
        hint: "归并排序的核心操作，时间复杂度 O(n)",
        importance: 'high',
        depth: this.currentDepth > 0 ? this.currentDepth : undefined
      }
    };
  }

  /**
   * 生成归并操作描述（归并排序merge-set步骤）
   * @param sourceIndex 源位置索引
   * @param targetIndex 目标位置索引
   * @param value 元素值
   * @param isLeft 是否来自左区间
   */
  generateMergeSet(
    sourceIndex: number,
    targetIndex: number,
    value: number,
    isLeft: boolean
  ): EnhancedDescription {
    const side = isLeft ? REGION_TERMS.merge.leftHalf : REGION_TERMS.merge.rightHalf;
    return {
      brief: `${side}的值 ${value} 移动到${normalizePosition(targetIndex)}`,
      detail: `${side}的值 ${value} 较小，从${normalizePosition(sourceIndex)} 移动到合并区${normalizePosition(targetIndex)}`,
      context: {
        phase: PHASE_TERMS.mergeSort.merge,
        hint: "归并排序通过比较两个有序子序列的元素，按顺序合并成新的有序序列",
        importance: 'medium',
        depth: this.currentDepth > 0 ? this.currentDepth : undefined
      }
    };
  }

  /**
   * 生成剩余元素处理描述（归并排序）
   * @param sourceIndex 源位置索引
   * @param targetIndex 目标位置索引
   * @param value 元素值
   * @param isLeft 是否来自左区间
   */
  generateMergeRemain(
    sourceIndex: number,
    targetIndex: number,
    value: number,
    isLeft: boolean
  ): EnhancedDescription {
    const side = isLeft ? REGION_TERMS.merge.leftHalf : REGION_TERMS.merge.rightHalf;
    return {
      brief: `${side}剩余值 ${value} 移动到${normalizePosition(targetIndex)}`,
      detail: `${side}还有剩余值 ${value}，从${normalizePosition(sourceIndex)} 直接移动到合并区${normalizePosition(targetIndex)}`,
      context: {
        phase: PHASE_TERMS.mergeSort.merge,
        hint: "当一侧元素全部用完，另一侧剩余元素直接放入合并区",
        importance: 'low',
        depth: this.currentDepth > 0 ? this.currentDepth : undefined
      }
    };
  }

  /**
   * 生成归并完成描述（归并排序merge-back步骤）
   * @param left 左边界
   * @param right 右边界
   */
  generateMergeBack(left: number, right: number): EnhancedDescription {
    return {
      brief: `区间 [${left}, ${right}] 合并完成，元素归位`,
      detail: `合并区已排序完成，所有元素从辅助数组回到主数组对应位置`,
      context: {
        phase: "合并阶段",
        hint: "归并排序的一次完整合并操作结束",
        importance: 'high',
        depth: this.currentDepth > 0 ? this.currentDepth : undefined
      }
    };
  }

  /**
   * 生成堆调整描述（堆排序）
   * @param root 根节点索引
   * @param end 堆范围结束位置
   */
  generateSiftDown(root: number, end: number): EnhancedDescription {
    const heapRange = root === 0 ? `[0, ${end}]` : `[${root}, ${end}]`;
    return {
      brief: `向下调整${REGION_TERMS.heap.heapTop}（${normalizePosition(root)}）`,
      detail: `将${normalizePosition(root)}向下移动到合适位置，维护${REGION_TERMS.heap.heap}性质（父节点≥子节点），当前堆范围：${heapRange}`,
      context: {
        phase: PHASE_TERMS.heapSort.buildHeap,
        hint: "向下调整（sift-down）是堆排序的核心操作，确保堆顶元素是最大/最小值",
        importance: 'high'
      }
    };
  }

  /**
   * 生成已排序标记描述
   * @param index 已排序元素索引
   * @param value 已排序元素值
   */
  generateSorted(index: number, value: number): EnhancedDescription {
    return {
      brief: `位置 ${index} 的元素 ${value} 已排序`,
      detail: `元素 ${value} 已到达最终位置，不再参与后续比较和交换`,
      context: {
        phase: this.getPhase(),
        importance: 'low'
      }
    };
  }

  /**
   * 生成插入排序的插入操作描述
   * @param index 待插入元素索引
   * @param value 待插入元素值
   */
  generateInsert(index: number, value: number): EnhancedDescription {
    return {
      brief: `将元素 ${value} 插入有序区`,
      detail: `将位置 ${index} 的元素 ${value} 插入到前面已排序区域的正确位置`,
      context: {
        phase: "插入阶段",
        hint: "插入排序通过构建有序序列，对未排序数据逐个插入",
        importance: 'medium'
      }
    };
  }

  /**
   * 生成桶操作描述（桶排序）
   * @param bucketIndex 桶索引
   * @param operation 操作类型：scatter（分桶）/ gather（收集）
   */
  generateBucketOperation(
    bucketIndex: number,
    operation: 'scatter' | 'gather'
  ): EnhancedDescription {
    if (operation === 'scatter') {
      return {
        brief: `将元素分配到桶 ${bucketIndex}`,
        detail: `根据元素值范围将其分配到对应的桶中，实现初步分组`,
        context: {
          phase: "分桶阶段",
          hint: "桶排序通过将数据分到有限数量的桶里，每个桶单独排序",
          importance: 'medium'
        }
      };
    } else {
      return {
        brief: `从桶 ${bucketIndex} 收集元素`,
        detail: `将桶 ${bucketIndex} 中已排序的元素按顺序放回主数组`,
        context: {
          phase: "收集阶段",
          hint: "收集阶段完成排序的最后步骤",
          importance: 'high'
        }
      };
    }
  }

  /**
   * 获取算法的默认阶段名称
   */
  private getPhase(): string {
    switch (this.algorithm) {
      case 'quick': return '分区阶段';
      case 'merge': return '合并阶段';
      case 'heap': return '建堆阶段';
      case 'bubble': return '扫描阶段';
      case 'insertion': return '插入阶段';
      case 'shell': return '希尔排序阶段';
      case 'bucket': return '桶排序阶段';
      default: return '排序阶段';
    }
  }
}

/**
 * 创建描述生成器的工厂函数
 * @param algorithm 算法类型
 * @param totalSteps 总步骤数（用于计算进度）
 */
export function createDescriptionGenerator(
  algorithm: SortAlgorithm,
  totalSteps?: number
): StepDescriptionGenerator {
  return new StepDescriptionGenerator(algorithm, totalSteps);
}
