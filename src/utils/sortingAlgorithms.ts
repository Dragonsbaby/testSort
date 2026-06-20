import type { SemanticStep } from "@/types/timeline";
import { calcBucketCount } from "@/types/sorting";
import { createDescriptionGenerator } from "./stepDescriptionGenerator";
import { normalizePosition, REGION_TERMS } from "./terminology-standards";

function createStep(
  type: SemanticStep["type"],
  indices: number[],
  description: string,
  arraySnapshot?: number[],
  gap?: number,
  groupIndices?: number[],
  tempSnapshot?: (number | null)[],
  bucketIndex?: number,
  bucketPos?: number,
): SemanticStep {
  return { type, indices, description, arraySnapshot, gap, groupIndices, tempSnapshot, bucketIndex, bucketPos };
}

export function bubbleSort(arr: number[]): SemanticStep[] {
  const steps: SemanticStep[] = [];
  const n = arr.length;
  const array = [...arr];

  // 边界情况：空数组返回空步骤
  if (n === 0) {
    return steps;
  }

  // 边界情况：单元素数组直接返回sorted步骤
  if (n === 1) {
    const generator = createDescriptionGenerator('bubble');
    const sortedDesc = generator.generateSorted(0, array[0]);
    steps.push(createStep("sorted", [0], sortedDesc.brief, [...array]));
    Object.assign(steps[steps.length - 1], {
      detail: sortedDesc.detail,
      context: sortedDesc.context
    });
    return steps;
  }

  // 创建描述生成器
  const generator = createDescriptionGenerator('bubble');
  generator.setPhase('扫描阶段');

  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n - i - 1; j++) {
      const compareDesc = generator.generateCompare([j, j + 1], [array[j], array[j + 1]]);
      steps.push(createStep(
        "compare",
        [j, j + 1],
        compareDesc.brief  // 使用生成的brief作为主描述
      ));
      Object.assign(steps[steps.length - 1], {
        detail: compareDesc.detail,
        context: compareDesc.context
      });

      if (array[j] > array[j + 1]) {
        // 在交换前保存原始值用于描述生成
        const [vi, vj] = [array[j], array[j + 1]];
        [array[j], array[j + 1]] = [array[j + 1], array[j]];
        const swapDesc = generator.generateSwap([j, j + 1], [vi, vj]);
        steps.push(createStep("swap", [j, j + 1], swapDesc.brief, [...array]));
        Object.assign(steps[steps.length - 1], {
          detail: swapDesc.detail,
          context: swapDesc.context
        });
      }
    }
    const sortedDesc = generator.generateSorted(n - i - 1, array[n - i - 1]);
    steps.push(createStep("sorted", [n - i - 1], sortedDesc.brief, [...array]));
    Object.assign(steps[steps.length - 1], {
      detail: sortedDesc.detail,
      context: sortedDesc.context
    });
  }

  // 添加第一个元素的sorted标记（只有当n > 1时才需要）
  if (n > 1) {
    const finalDesc = generator.generateSorted(0, array[0]);
    steps.push(createStep("sorted", [0], finalDesc.brief, [...array]));
    Object.assign(steps[steps.length - 1], {
      detail: finalDesc.detail,
      context: finalDesc.context
    });
  }

  return steps;
}

export function insertionSort(arr: number[]): SemanticStep[] {
  const steps: SemanticStep[] = [];
  const n = arr.length;
  const array = [...arr];

  // 边界情况：空数组返回空步骤
  if (n === 0) {
    return steps;
  }

  // 创建描述生成器
  const generator = createDescriptionGenerator('insertion');
  generator.setPhase('插入排序阶段');

  // 初始状态：第一个元素默认有序
  const initialDesc = generator.generateSorted(0, array[0]);
  steps.push(createStep("sorted", [0], `${array[0]} 作为初始有序序列`, [...array]));
  Object.assign(steps[steps.length - 1], {
    brief: initialDesc.brief,
    detail: `第一个元素 ${array[0]} 默认为有序序列的开始`,
    context: {
      phase: "初始阶段",
      hint: "插入排序将数组分为有序区和无序区，逐个将无序区元素插入有序区"
    }
  });

  for (let i = 1; i < n; i++) {
    const key = array[i];
    let j = i - 1;

    const insertDesc = generator.generateInsert(i, key);
    steps.push(createStep("compare", [i], `准备插入 ${key}`, [...array]));
    Object.assign(steps[steps.length - 1], {
      brief: insertDesc.brief,
      detail: `将元素 ${key} 插入到前面的有序区域 [0, ${i - 1}] 中`,
      context: {
        ...insertDesc.context,
        phase: "插入阶段",
        targetRange: `[0, ${i - 1}]`
      }
    });

    while (j >= 0 && array[j] > key) {
      const compareDesc = generator.generateCompare([j, j + 1], [array[j], key], {
        phase: '插入阶段'
      });
      steps.push(createStep("compare", [j, j + 1], `比较 ${array[j]} 和 ${key}`, [...array]));
      Object.assign(steps[steps.length - 1], {
        brief: compareDesc.brief,
        detail: `${compareDesc.detail}，${array[j]} > ${key}，需要继续向前查找`,
        context: { ...compareDesc.context, phase: '插入阶段' }
      });

      [array[j], array[j + 1]] = [array[j + 1], array[j]];
      const swapDesc = generator.generateSwap([j, j + 1], [array[j], array[j + 1]]);
      steps.push(createStep("swap", [j, j + 1], `将 ${array[j]} 右移`, [...array]));
      Object.assign(steps[steps.length - 1], {
        brief: `元素 ${array[j + 1]} 向右移动，为插入腾出空间`,
        detail: `${swapDesc.detail}，在有序区中找到合适位置`,
        context: { ...swapDesc.context, phase: '插入阶段' }
      });
      j--;
    }

    const sortedRange = Array.from({ length: i + 1 }, (_, idx) => idx);
    steps.push(createStep("sorted", sortedRange, `位置 0-${i} 已有序`, [...array]));
    Object.assign(steps[steps.length - 1], {
      brief: `前 ${i + 1} 个元素已排序`,
      detail: `位置 [0, ${i}] 范围内的元素已按升序排列`,
      context: {
        phase: "插入阶段",
        hint: "每次插入一个元素，有序区长度增加1",
        progress: Math.round(((i + 1) / n) * 100)
      }
    });
  }

  const finalDesc = generator.generateSorted(0, array[0]);
  steps.push(createStep("sorted", Array.from({ length: n }, (_, i) => i), `排序完成`, [...array]));
  Object.assign(steps[steps.length - 1], {
    brief: finalDesc.brief,
    detail: `插入排序完成，共 ${n} 个元素，时间复杂度 O(n²)`,
    context: {
      phase: "完成阶段",
      hint: "插入排序对小规模或基本有序的数据效率较高"
    }
  });

  return steps;
}

export function mergeSort(arr: number[]): SemanticStep[] {
  const steps: SemanticStep[] = [];
  const array = [...arr];

  // 边界情况：空数组返回空步骤
  if (array.length === 0) {
    return steps;
  }

  // 创建描述生成器
  const generator = createDescriptionGenerator('merge');

  function merge(left: number, mid: number, right: number) {
    generator.setDepth(Math.floor(Math.log2(right - left + 1)) + 1);
    generator.setPhase('合并阶段');

    const leftArr = array.slice(left, mid + 1);
    const rightArr = array.slice(mid + 1, right + 1);
    // 合并区间全部索引（上排 pending 紫色标记范围）
    const mergeRange = Array.from({ length: right - left + 1 }, (_, idx) => left + idx);
    // 辅助数组（仅用于计算最终快照，不再用于下排槽位渲染）
    const temp: number[] = new Array(right - left + 1);

    let i = 0, j = 0, k = left;

    // 合并开始：通知画布准备（下排此时为空，上排高亮整个合并区间）
    const mergeDesc = generator.generateMerge(left, mid, right);
    steps.push(createStep(
      "compare", [left, right],
      `合并区间 [${left}, ${mid}] 和 [${mid + 1}, ${right}]`,
      [...array], undefined, mergeRange
    ));
    Object.assign(steps[steps.length - 1], {
      brief: mergeDesc.brief,
      detail: mergeDesc.detail,
      context: mergeDesc.context
    });

    while (i < leftArr.length && j < rightArr.length) {
      const compareDesc = generator.generateCompare(
        [left + i, mid + 1 + j],
        [leftArr[i], rightArr[j]],
        { phase: '合并阶段' }
      );
      steps.push(createStep(
        "compare", [left + i, mid + 1 + j],
        `比较${REGION_TERMS.merge.leftSection}${normalizePosition(left + i, leftArr[i])}和${REGION_TERMS.merge.rightSection}${normalizePosition(mid + 1 + j, rightArr[j])}`,
        [...array], undefined, mergeRange
      ));
      Object.assign(steps[steps.length - 1], {
        brief: compareDesc.brief,
        detail: compareDesc.detail,
        context: compareDesc.context
      });

      if (leftArr[i] <= rightArr[j]) {
        temp[k - left] = leftArr[i];
        // indices[0]=源索引（从上排哪个位置飞下来），indices[1]=目标位置（下排输出列）
        const mergeSetDesc = generator.generateMergeSet(left + i, k, leftArr[i], true);
        steps.push(createStep(
          "merge-set", [left + i, k],
          `左区间值 ${leftArr[i]} 较小，移动到合并区位置 ${k}`,
          [...array], undefined, mergeRange
        ));
        Object.assign(steps[steps.length - 1], {
          brief: mergeSetDesc.brief,
          detail: mergeSetDesc.detail,
          context: mergeSetDesc.context
        });
        i++;
      } else {
        temp[k - left] = rightArr[j];
        const mergeSetDesc = generator.generateMergeSet(mid + 1 + j, k, rightArr[j], false);
        steps.push(createStep(
          "merge-set", [mid + 1 + j, k],
          `右区间值 ${rightArr[j]} 较小，移动到合并区位置 ${k}`,
          [...array], undefined, mergeRange
        ));
        Object.assign(steps[steps.length - 1], {
          brief: mergeSetDesc.brief,
          detail: mergeSetDesc.detail,
          context: mergeSetDesc.context
        });
        j++;
      }
      k++;
    }

    while (i < leftArr.length) {
      temp[k - left] = leftArr[i];
      const remainDesc = generator.generateMergeRemain(left + i, k, leftArr[i], true);
      steps.push(createStep(
        "merge-set", [left + i, k],
        `左区间剩余值 ${leftArr[i]} 直接移动到合并区位置 ${k}`,
        [...array], undefined, mergeRange
      ));
      Object.assign(steps[steps.length - 1], {
        brief: remainDesc.brief,
        detail: remainDesc.detail,
        context: remainDesc.context
      });
      i++; k++;
    }

    while (j < rightArr.length) {
      temp[k - left] = rightArr[j];
      const remainDesc = generator.generateMergeRemain(mid + 1 + j, k, rightArr[j], false);
      steps.push(createStep(
        "merge-set", [mid + 1 + j, k],
        `右区间剩余值 ${rightArr[j]} 直接移动到合并区位置 ${k}`,
        [...array], undefined, mergeRange
      ));
      Object.assign(steps[steps.length - 1], {
        brief: remainDesc.brief,
        detail: remainDesc.detail,
        context: remainDesc.context
      });
      j++; k++;
    }

    // 将辅助数组复写回主数组
    for (let m = left; m <= right; m++) {
      array[m] = temp[m - left];
    }

    // 通知画布：合并完成，下排所有元素一起飞回上排
    const mergeBackDesc = generator.generateMergeBack(left, right);
    steps.push(createStep(
      "merge-back", mergeRange,
      `区间 [${left}, ${right}] 合并完成，全部归位`,
      [...array], undefined, undefined
    ));
    Object.assign(steps[steps.length - 1], {
      brief: mergeBackDesc.brief,
      detail: mergeBackDesc.detail,
      context: mergeBackDesc.context
    });
  }

  function sort(left: number, right: number) {
    if (left >= right) return;

    const depth = Math.floor(Math.log2(right - left + 1)) + 1;
    generator.setDepth(depth);
    generator.setPhase('分割阶段');

    const mid = Math.floor((left + right) / 2);
    steps.push(createStep("compare", [left, mid, right], `分割区间 [${left}, ${right}]，中点为 ${mid}`, [...array]));
    Object.assign(steps[steps.length - 1], {
      brief: `将区间 [${left}, ${right}] 分割为两部分`,
      detail: `选择中点 ${mid}，将区间分为 [${left}, ${mid}] 和 [${mid + 1}, ${right}]`,
      context: {
        phase: "分割阶段",
        hint: "归并排序采用分治策略，先分割再合并",
        importance: 'low',
        depth: depth
      }
    });

    sort(left, mid);
    sort(mid + 1, right);
    merge(left, mid, right);
  }

  sort(0, array.length - 1);
  const sortedDesc = generator.generateSorted(0, array[0]);
  steps.push(createStep("sorted", Array.from({ length: array.length }, (_, i) => i), `排序完成`, [...array]));
  Object.assign(steps[steps.length - 1], {
    brief: sortedDesc.brief,
    detail: `所有元素已按升序排列完成，共 ${array.length} 个元素`,
    context: {
      phase: "完成阶段",
      hint: "归并排序的时间复杂度为 O(n log n)，是稳定的排序算法"
    }
  });

  return steps;
}

export function quickSort(arr: number[]): SemanticStep[] {
  const steps: SemanticStep[] = [];
  const array = [...arr];

  // 边界情况：空数组返回空步骤
  if (array.length === 0) {
    return steps;
  }

  // 创建描述生成器
  const generator = createDescriptionGenerator('quick');
  generator.setPhase('分区阶段');

  function partition(low: number, high: number): number {
    const pivot = array[high];
    const pivotDesc = generator.generatePivot(high, pivot);
    steps.push(createStep("pivot", [high], `选择 ${pivot} 作为基准值`, [...array]));
    Object.assign(steps[steps.length - 1], {
      brief: pivotDesc.brief,
      detail: pivotDesc.detail,
      context: { ...pivotDesc.context, depth: generator['currentDepth'] }
    });

    let i = low - 1;

    for (let j = low; j < high; j++) {
      const compareDesc = generator.generateCompare([j, high], [array[j], pivot], {
        phase: '分区阶段',
        depth: generator['currentDepth']
      });
      steps.push(createStep("compare", [j, high], `比较 ${array[j]} 与基准 ${pivot}`, [...array]));
      Object.assign(steps[steps.length - 1], {
        brief: compareDesc.brief,
        detail: compareDesc.detail,
        context: compareDesc.context
      });

      if (array[j] < pivot) {
        i++;
        if (i !== j) {
          [array[i], array[j]] = [array[j], array[i]];
          const swapDesc = generator.generateSwap([i, j], [array[i], array[j]]);
          steps.push(createStep("swap", [i, j], `交换 ${array[i]} 和 ${array[j]}`, [...array]));
          Object.assign(steps[steps.length - 1], {
            brief: swapDesc.brief,
            detail: swapDesc.detail,
            context: { ...swapDesc.context, depth: generator['currentDepth'] }
          });
        }
      }
    }

    if (i + 1 !== high) {
      [array[i + 1], array[high]] = [array[high], array[i + 1]];
      const swapDesc = generator.generateSwap([i + 1, high], [array[i + 1], array[high]]);
      steps.push(createStep("swap", [i + 1, high], `将基准 ${array[i + 1]} 放到分区点`, [...array]));
      Object.assign(steps[steps.length - 1], {
        brief: swapDesc.brief,
        detail: swapDesc.detail,
        context: { ...swapDesc.context, depth: generator['currentDepth'] }
      });
    }

    steps.push(createStep("sorted", [i + 1], `基准 ${array[i + 1]} 已到达最终位置`, [...array]));

    return i + 1;
  }

  function sort(low: number, high: number) {
    if (low >= high) {
      if (low === high) {
        steps.push(createStep("sorted", [low], `${array[low]} 已到达最终位置`, [...array]));
      }
      return;
    }

    const pi = partition(low, high);
    sort(low, pi - 1);
    sort(pi + 1, high);
  }

  sort(0, array.length - 1);
  // 添加最终sorted步骤标记所有元素
  const allIndices = Array.from({ length: array.length }, (_, i) => i);
  steps.push(createStep("sorted", allIndices, `排序完成`, [...array]));
  return steps;
}

export function shellSort(arr: number[]): SemanticStep[] {
  const steps: SemanticStep[] = [];
  const a = [...arr];
  const n = a.length;

  // 边界情况：空数组返回空步骤
  if (n === 0) {
    return steps;
  }

  // 创建描述生成器
  const generator = createDescriptionGenerator('shell');
  const totalIterations = Math.floor(Math.log2(n)) + 1;
  let currentIteration = 0;

  for (let gap = Math.floor(n / 2); gap > 0; gap = Math.floor(gap / 2)) {
    currentIteration++;
    generator.setPhase(`间隔 ${gap} 排序阶段`);

    const gapPhaseDesc = {
      brief: `开始间隔为 ${gap} 的排序`,
      detail: `当前间隔 ${gap}，将数组分为 ${gap} 个子序列分别进行插入排序`,
      context: {
        phase: `间隔 ${gap} 阶段`,
        hint: `希尔排序通过递减间隔改进插入排序，间隔越大跳跃幅度越大`,
        importance: 'high',
        iteration: currentIteration,
        gap: gap
      }
    };

    // 在每组开始前添加阶段说明
    const firstGroupStep = createStep("compare", [gap], `使用间隔 ${gap} 进行排序`, [...a], gap, []);
    Object.assign(firstGroupStep, gapPhaseDesc);
    steps.push(firstGroupStep);

    for (let i = gap; i < n; i++) {
      // 计算当前 i 所属的组：所有 ≡ i (mod gap) 的索引（包括 i 之前和之后的同组元素）
      const group: number[] = [];
      const remainder = i % gap;
      for (let k = remainder; k < n; k += gap) group.push(k);

      let j = i;
      while (j >= gap) {
        const compareDesc = generator.generateCompare([j - gap, j], [a[j - gap], a[j]], {
          phase: `间隔 ${gap} 阶段`
        });
        steps.push(createStep("compare", [j - gap, j], `比较间隔 ${gap} 的元素 ${a[j - gap]} 和 ${a[j]}`, undefined, gap, group));
        Object.assign(steps[steps.length - 1], {
          brief: compareDesc.brief.replace(/位置/g, '同组位置'),
          detail: `在间隔 ${gap} 的分组中${compareDesc.detail}`,
          context: {
            ...compareDesc.context,
            phase: `间隔 ${gap} 阶段`,
            groupIndices: group
          }
        });

        if (a[j - gap] > a[j]) {
          [a[j - gap], a[j]] = [a[j], a[j - gap]];
          const swapDesc = generator.generateSwap([j - gap, j], [a[j - gap], a[j]]);
          steps.push(createStep("swap", [j - gap, j], `交换 ${a[j - gap]} 和 ${a[j]}`, [...a], gap, group));
          Object.assign(steps[steps.length - 1], {
            brief: swapDesc.brief.replace(/位置/g, '同组位置'),
            detail: `在间隔 ${gap} 的分组中${swapDesc.detail}`,
            context: {
              ...swapDesc.context,
              phase: `间隔 ${gap} 阶段`,
              groupIndices: group
            }
          });
          j -= gap;
        } else {
          break;
        }
      }
    }

    // 间隔完成说明
    if (gap > 1) {
      const gapCompleteDesc = {
        brief: `间隔 ${gap} 排序完成`,
        detail: `所有间隔为 ${gap} 的子序列已排序，准备缩小间隔继续优化`,
        context: {
          phase: `间隔 ${gap} 阶段`,
          hint: `随着间隔缩小，数组逐渐接近最终排序状态`,
          importance: 'medium',
          progress: Math.round((currentIteration / totalIterations) * 100)
        }
      };

      const gapCompleteStep = createStep("sorted", [], `间隔 ${gap} 完成`, [...a]);
      Object.assign(gapCompleteStep, gapCompleteDesc);
      steps.push(gapCompleteStep);
    }
  }

  const finalDesc = generator.generateSorted(0, a[0]);
  const sortedIndices = Array.from({ length: n }, (_, i) => i);
  steps.push(createStep("sorted", sortedIndices, "排序完成", [...a]));
  Object.assign(steps[steps.length - 1], {
    brief: finalDesc.brief,
    detail: `希尔排序完成，共经过 ${totalIterations} 轮间隔递减排序`,
    context: {
      phase: "完成阶段",
      hint: `希尔排序时间复杂度 O(n log² n)，是插入排序的改进版本`
    }
  });

  return steps;
}

/** 桶排序（动态桶数：每 10 个元素一个桶，上限 9，桶数需与 bucket-layout 的 calcBucketCount 保持一致） */
export function bucketSort(arr: number[]): SemanticStep[] {
  const steps: SemanticStep[] = [];
  const a = [...arr];
  const n = a.length;

  // 边界情况：空数组返回空步骤
  if (n === 0) {
    return steps;
  }

  const K = calcBucketCount(n);
  const minV = Math.min(...a);
  const maxV = Math.max(...a);
  const range = maxV - minV + 1;

  // 创建描述生成器
  const generator = createDescriptionGenerator('bucket');

  // ── 分桶 ────────────────────────────────────────────────────────────
  const bkts: number[][] = Array.from({ length: K }, () => []);
  for (let i = 0; i < n; i++) {
    const bi = Math.min(K - 1, Math.floor(((a[i] - minV) / range) * K));

    const scatterDesc = generator.generateBucketOperation(bi, 'scatter');
    steps.push(createStep(
      "bucket-scatter", [i],
      `将 ${a[i]} 分配到桶 ${bi}`,
      undefined, undefined, undefined, undefined,
      bi, bkts[bi].length,
    ));
    Object.assign(steps[steps.length - 1], {
      brief: scatterDesc.brief,
      detail: `元素 ${a[i]} 基于值域分配到桶 ${bi}，范围 [${minV + Math.floor(range * bi / K)}, ${minV + Math.floor(range * (bi + 1) / K) - 1}]`,
      context: {
        ...scatterDesc.context,
        bucketInfo: `桶 ${bi}/${K}`,
        valueRange: `[${minV + Math.floor(range * bi / K)}, ${minV + Math.floor(range * (bi + 1) / K) - 1}]`
      }
    });

    bkts[bi].push(a[i]);
  }

  // ── 桶内插入排序 ──────────────────────────────────────────────────
  generator.setPhase('桶内排序阶段');
  for (let bi = 0; bi < K; bi++) {
    const b = bkts[bi];
    if (b.length <= 1) continue;

    for (let i = 1; i < b.length; i++) {
      let j = i;
      while (j > 0) {
        const compareDesc = generator.generateCompare([j - 1, j], [b[j - 1], b[j]], {
          phase: '桶内排序阶段',
          bucketIndex: bi
        });
        steps.push(createStep(
          "bucket-compare", [j - 1, j],
          `桶 ${bi} 内排序：比较 ${b[j - 1]} 与 ${b[j]}`,
          undefined, undefined, undefined, undefined, bi,
        ));
        Object.assign(steps[steps.length - 1], {
          brief: compareDesc.brief.replace(/位置/g, `桶 ${bi} 位置`),
          detail: `在桶 ${bi} 中${compareDesc.detail}`,
          context: { ...compareDesc.context, bucketIndex: bi }
        });

        if (b[j - 1] > b[j]) {
          const swapDesc = generator.generateSwap([j - 1, j], [b[j - 1], b[j]]);
          steps.push(createStep(
            "bucket-swap", [j - 1, j],
            `桶 ${bi} 内排序：交换 ${b[j - 1]} ↔ ${b[j]}`,
            undefined, undefined, undefined, undefined, bi,
          ));
          Object.assign(steps[steps.length - 1], {
            brief: swapDesc.brief.replace(/位置/g, `桶 ${bi} 位置`),
            detail: `在桶 ${bi} 中${swapDesc.detail}`,
            context: { ...swapDesc.context, bucketIndex: bi }
          });
          [b[j - 1], b[j]] = [b[j], b[j - 1]];
          j--;
        } else {
          break;
        }
      }
    }
  }

  // ── 收集归位 ──────────────────────────────────────────────────────
  generator.setPhase('收集阶段');
  const result = [...a];
  let gp = 0;
  for (let bi = 0; bi < K; bi++) {
    for (let k = 0; k < bkts[bi].length; k++) {
      result[gp] = bkts[bi][k];

      const gatherDesc = generator.generateBucketOperation(bi, 'gather');
      steps.push(createStep(
        "bucket-gather", [gp],
        `收集：桶 ${bi} 中的值 ${bkts[bi][k]} 放回主数组${normalizePosition(gp)}`,
        [...result], undefined, undefined, undefined, bi,
      ));
      Object.assign(steps[steps.length - 1], {
        brief: gatherDesc.brief,
        detail: `将桶 ${bi} 中已排序的元素 ${bkts[bi][k]} 按顺序放回主数组位置 ${gp}`,
        context: {
          ...gatherDesc.context,
          bucketIndex: bi,
          totalProgress: Math.floor((gp / n) * 100)
        }
      });

      gp++;
    }
  }

  const sortedDesc = generator.generateSorted(0, result[0]);
  steps.push(createStep("sorted", Array.from({ length: n }, (_, i) => i), "排序完成", [...result]));
  Object.assign(steps[steps.length - 1], {
    brief: sortedDesc.brief,
    detail: `桶排序完成，${n} 个元素分配到 ${K} 个桶中分别排序后收集`,
    context: {
      phase: "完成阶段",
      hint: `桶排序时间复杂度 O(n + k)，k 为桶数，适用于数据分布均匀的情况`
    }
  });

  return steps;
}

/**
 * 堆排序
 * @param arr   原始数组（数值）
 * @param mode  'max' = 最大堆 → 升序；'min' = 最小堆 → 降序
 */
export function heapSort(arr: number[], mode: "max" | "min" = "max"): SemanticStep[] {
  const steps: SemanticStep[] = [];
  const a = [...arr];
  const n = a.length;

  // 边界情况：空数组返回空步骤
  if (n === 0) {
    return steps;
  }

  // 创建描述生成器
  const generator = createDescriptionGenerator('heap');
  const heapType = mode === 'max' ? '最大堆' : '最小堆';
  const orderGoal = mode === 'max' ? '升序' : '降序';

  // 比较器：最大堆要求父 ≥ 子，最小堆要求父 ≤ 子
  const shouldSwap = (parent: number, child: number) =>
    mode === "max" ? a[parent] < a[child] : a[parent] > a[child];

  // 向下调整：将 root 节点向下调整到 [root, end] 范围内满足堆性质
  function siftDown(root: number, end: number, phase: '建堆阶段' | '提取阶段') {
    const heapRange = Array.from({ length: end + 1 }, (_, k) => k);

    const siftDownDesc = generator.generateSiftDown(root, end);
    steps.push(createStep("pivot", [root], `sift-down ${REGION_TERMS.heap.heapTop}${normalizePosition(root, a[root])}`, undefined, undefined, heapRange));
    Object.assign(steps[steps.length - 1], {
      brief: siftDownDesc.brief,
      detail: `${heapType}${siftDownDesc.detail}`,
      context: { ...siftDownDesc.context, phase }
    });

    while (true) {
      let target = root;
      const l = 2 * root + 1;
      const r = 2 * root + 2;

      if (l <= end) {
        const compareDesc = generator.generateCompare([target, l], [a[target], a[l]], {
          phase
        });
        steps.push(createStep("compare", [target, l], `比较 [${target}]=${a[target]} 和${REGION_TERMS.heap.leftChild} [${l}]=${a[l]}`, undefined, undefined, heapRange));
        Object.assign(steps[steps.length - 1], {
          brief: compareDesc.brief,
          detail: `${compareDesc.detail}，${mode === 'max' ? '较大者' : '较小者'}上浮`,
          context: { ...compareDesc.context, phase }
        });
        if (shouldSwap(target, l)) target = l;
      }
      if (r <= end) {
        const compareDesc = generator.generateCompare([target, r], [a[target], a[r]], {
          phase
        });
        steps.push(createStep("compare", [target, r], `比较 [${target}]=${a[target]} 和${REGION_TERMS.heap.rightChild} [${r}]=${a[r]}`, undefined, undefined, heapRange));
        Object.assign(steps[steps.length - 1], {
          brief: compareDesc.brief,
          detail: `${compareDesc.detail}，${mode === 'max' ? '较大者' : '较小者'}上浮`,
          context: { ...compareDesc.context, phase }
        });
        if (shouldSwap(target, r)) target = r;
      }

      if (target === root) break;

      [a[root], a[target]] = [a[target], a[root]];
      const swapDesc = generator.generateSwap([root, target], [a[root], a[target]]);
      steps.push(createStep("swap", [root, target], `交换 [${root}]=${a[root]} 和 [${target}]=${a[target]}`, [...a], undefined, heapRange));
      Object.assign(steps[steps.length - 1], {
        brief: swapDesc.brief,
        detail: `${swapDesc.detail}，维护${heapType}性质`,
        context: { ...swapDesc.context, phase }
      });
      root = target;
    }
  }

  // 阶段一：建堆（从最后一个非叶节点向上 sift-down）
  for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
    siftDown(i, n - 1, '建堆阶段');
  }

  // 阶段二：逐个将堆顶提取到末尾
  for (let end = n - 1; end > 0; end--) {
    const previewRange = Array.from({ length: end + 1 }, (_, k) => k);

    steps.push(createStep("compare", [0, end], `提取堆顶 [0]=${a[0]} 准备与末尾 [${end}]=${a[end]} 交换`, undefined, undefined, previewRange));
    Object.assign(steps[steps.length - 1], {
      brief: `准备将堆顶 ${a[0]} 提取到末尾位置 ${end}`,
      detail: `堆顶元素 ${a[0]} 是当前${mode === 'max' ? '最大' : '最小'}值，将它移到已排序区域的末尾`,
      context: {
        phase: "提取阶段",
        hint: `${heapType}排序的核心：反复提取堆顶元素并重新调整堆`,
        importance: 'high'
      }
    });

    [a[0], a[end]] = [a[end], a[0]];
    const heapRange = Array.from({ length: end }, (_, k) => k);

    const swapDesc = generator.generateSwap([0, end], [a[0], a[end]]);
    steps.push(createStep("swap", [0, end], `提取堆顶 [0]=${a[0]} → 末尾 [${end}]`, [...a], undefined, heapRange));
    Object.assign(steps[steps.length - 1], {
      brief: `堆顶 ${a[end]} 移到位置 ${end}，末尾 ${a[0]} 移到堆顶`,
      detail: `${mode === 'max' ? '最大值' : '最小值'} ${a[end]} 已就位，末尾元素 ${a[0]} 回到堆顶`,
      context: { ...swapDesc.context, phase: '提取阶段' }
    });

    const sortedDesc = generator.generateSorted(end, a[end]);
    steps.push(createStep("sorted", [end], `[${end}]=${a[end]} 已就位`, [...a], undefined, heapRange));
    Object.assign(steps[steps.length - 1], {
      brief: sortedDesc.brief,
      detail: `位置 ${end} 的值 ${a[end]} 已确定${orderGoal}位置`,
      context: { ...sortedDesc.context, phase: '提取阶段' }
    });

    if (end > 1) siftDown(0, end - 1, '提取阶段');
  }

  const finalDesc = generator.generateSorted(0, a[0]);
  steps.push(createStep("sorted", [0], `[0]=${a[0]} 已就位，排序完成`, [...a]));
  Object.assign(steps[steps.length - 1], {
    brief: finalDesc.brief,
    detail: `${heapType}${orderGoal}排序完成，共 ${n} 个元素`,
    context: {
      phase: "完成阶段",
      hint: `堆排序时间复杂度 O(n log n)，空间复杂度 O(1)，是${orderGoal}排序算法`
    }
  });

  return steps;
}
