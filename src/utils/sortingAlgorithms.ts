import type { SortStep } from "@/types/sorting";
import { calcBucketCount } from "@/types/sorting";

function createStep(
  type: SortStep["type"],
  indices: number[],
  description: string,
  arraySnapshot?: number[],
  gap?: number,
  groupIndices?: number[],
  tempSnapshot?: (number | null)[],
  bucketIndex?: number,
  bucketPos?: number,
): SortStep {
  return { type, indices, description, arraySnapshot, gap, groupIndices, tempSnapshot, bucketIndex, bucketPos };
}

export function bubbleSort(arr: number[]): SortStep[] {
  const steps: SortStep[] = [];
  const n = arr.length;
  const array = [...arr];

  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n - i - 1; j++) {
      steps.push(createStep("compare", [j, j + 1], `比较 arr[${j}]=${array[j]} 和 arr[${j + 1}]=${array[j + 1]}`));

      if (array[j] > array[j + 1]) {
        steps.push(createStep("swap", [j, j + 1], `交换 arr[${j}] 和 arr[${j + 1}]`, [...array]));
        [array[j], array[j + 1]] = [array[j + 1], array[j]];
      }
    }
    steps.push(createStep("sorted", [n - i - 1], `arr[${n - i - 1}]=${array[n - i - 1]} 已排序`, [...array]));
  }

  steps.push(createStep("sorted", [0], `arr[0]=${array[0]} 已排序`, [...array]));
  return steps;
}

export function insertionSort(arr: number[]): SortStep[] {
  const steps: SortStep[] = [];
  const n = arr.length;
  const array = [...arr];

  steps.push(createStep("sorted", [0], `arr[0]=${array[0]} 已排序（作为初始有序区）`, [...array]));

  for (let i = 1; i < n; i++) {
    const key = array[i];
    let j = i - 1;

    steps.push(createStep("compare", [i], `将 arr[${i}]=${key} 插入有序区`, [...array]));

    while (j >= 0 && array[j] > key) {
      steps.push(createStep("compare", [j, j + 1], `比较 arr[${j}]=${array[j]} 和 key=${key}`, [...array]));
      // 用真正的 swap 模拟 key 与左元素交换（实现右移效果）
      steps.push(createStep("swap", [j, j + 1], `交换 arr[${j}]=${array[j]} 和 arr[${j + 1}]=${key}`, [...array]));
      [array[j], array[j + 1]] = [array[j + 1], array[j]];
      j--;
    }
    steps.push(createStep("sorted", [0, i], `0-${i} 范围已排序`, [...array]));
  }

  steps.push(createStep("sorted", Array.from({ length: n }, (_, i) => i), `排序完成`, [...array]));
  return steps;
}

export function mergeSort(arr: number[]): SortStep[] {
  const steps: SortStep[] = [];
  const array = [...arr];

  function merge(left: number, mid: number, right: number) {
    const leftArr = array.slice(left, mid + 1);
    const rightArr = array.slice(mid + 1, right + 1);
    // 合并区间全部索引（上排 pending 紫色标记范围）
    const mergeRange = Array.from({ length: right - left + 1 }, (_, idx) => left + idx);
    // 辅助数组（仅用于计算最终快照，不再用于下排槽位渲染）
    const temp: number[] = new Array(right - left + 1);

    let i = 0, j = 0, k = left;

    // 合并开始：通知画布准备（下排此时为空，上排高亮整个合并区间）
    steps.push(createStep(
      "compare", [left, right],
      `合并区间 [${left}, ${mid}] 和 [${mid + 1}, ${right}]`,
      [...array], undefined, mergeRange
    ));

    while (i < leftArr.length && j < rightArr.length) {
      steps.push(createStep(
        "compare", [left + i, mid + 1 + j],
        `比较 leftArr[${i}]=${leftArr[i]} 和 rightArr[${j}]=${rightArr[j]}`,
        [...array], undefined, mergeRange
      ));

      if (leftArr[i] <= rightArr[j]) {
        temp[k - left] = leftArr[i];
        // indices[0]=源索引（从上排哪个位置飞下来），indices[1]=目标位置（下排输出列）
        steps.push(createStep(
          "merge-set", [left + i, k],
          `${leftArr[i]} 胜出，从位置 ${left + i} 飞入下排第 ${k} 槽`,
          [...array], undefined, mergeRange
        ));
        i++;
      } else {
        temp[k - left] = rightArr[j];
        steps.push(createStep(
          "merge-set", [mid + 1 + j, k],
          `${rightArr[j]} 胜出，从位置 ${mid + 1 + j} 飞入下排第 ${k} 槽`,
          [...array], undefined, mergeRange
        ));
        j++;
      }
      k++;
    }

    while (i < leftArr.length) {
      temp[k - left] = leftArr[i];
      steps.push(createStep(
        "merge-set", [left + i, k],
        `剩余 leftArr[${i}]=${leftArr[i]} 飞入下排第 ${k} 槽`,
        [...array], undefined, mergeRange
      ));
      i++; k++;
    }

    while (j < rightArr.length) {
      temp[k - left] = rightArr[j];
      steps.push(createStep(
        "merge-set", [mid + 1 + j, k],
        `剩余 rightArr[${j}]=${rightArr[j]} 飞入下排第 ${k} 槽`,
        [...array], undefined, mergeRange
      ));
      j++; k++;
    }

    // 将辅助数组复写回主数组
    for (let m = left; m <= right; m++) {
      array[m] = temp[m - left];
    }
    // 通知画布：合并完成，下排所有元素一起飞回上排
    steps.push(createStep(
      "merge-back", mergeRange,
      `区间 [${left}, ${right}] 合并完成，全部归位`,
      [...array], undefined, undefined
    ));
  }

  function sort(left: number, right: number) {
    if (left >= right) return;

    const mid = Math.floor((left + right) / 2);
    steps.push(createStep("compare", [left, mid, right], `分割区间 [${left}, ${right}]，中点为 ${mid}`, [...array]));

    sort(left, mid);
    sort(mid + 1, right);
    merge(left, mid, right);
  }

  sort(0, array.length - 1);
  steps.push(createStep("sorted", Array.from({ length: array.length }, (_, i) => i), `排序完成`, [...array]));

  return steps;
}

export function quickSort(arr: number[]): SortStep[] {
  const steps: SortStep[] = [];
  const array = [...arr];

  function partition(low: number, high: number): number {
    const pivot = array[high];
    steps.push(createStep("pivot", [high], `选择 arr[${high}]=${pivot} 作为基准`, [...array]));

    let i = low - 1;

    for (let j = low; j < high; j++) {
      steps.push(createStep("compare", [j, high], `比较 arr[${j}]=${array[j]} 和 pivot=${pivot}`, [...array]));

      if (array[j] < pivot) {
        i++;
        if (i !== j) {
          steps.push(createStep("swap", [i, j], `交换 arr[${i}]=${array[i]} 和 arr[${j}]=${array[j]}`, [...array]));
          [array[i], array[j]] = [array[j], array[i]];
        }
      }
    }

    if (i + 1 !== high) {
      steps.push(createStep("swap", [i + 1, high], `将基准放到正确位置 arr[${i + 1}]=${array[i + 1]}`, [...array]));
      [array[i + 1], array[high]] = [array[high], array[i + 1]];
    }

    steps.push(createStep("sorted", [i + 1], `arr[${i + 1}]=${array[i + 1]} 已在正确位置`, [...array]));

    return i + 1;
  }

  function sort(low: number, high: number) {
    if (low >= high) {
      if (low === high) {
        steps.push(createStep("sorted", [low], `arr[${low}]=${array[low]} 已排序`, [...array]));
      }
      return;
    }

    const pi = partition(low, high);
    sort(low, pi - 1);
    sort(pi + 1, high);
  }

  sort(0, array.length - 1);
  steps.push(createStep("sorted", Array.from({ length: array.length }, (_, i) => i), `排序完成`, [...array]));

  return steps;
}

export function shellSort(arr: number[]): SortStep[] {
  const steps: SortStep[] = [];
  const a = [...arr];
  const n = a.length;

  for (let gap = Math.floor(n / 2); gap > 0; gap = Math.floor(gap / 2)) {
    for (let i = gap; i < n; i++) {
      // 计算当前 i 所属的组：所有 ≡ i (mod gap) 的索引（包括 i 之前和之后的同组元素）
      const group: number[] = [];
      const remainder = i % gap;
      for (let k = remainder; k < n; k += gap) group.push(k);
      let j = i;
      while (j >= gap) {
        steps.push(createStep("compare", [j - gap, j], `比较间隔 ${gap} 内的元素 [${j - gap}]=${a[j - gap]} 和 [${j}]=${a[j]}`, undefined, gap, group));
        if (a[j - gap] > a[j]) {
          steps.push(createStep("swap", [j - gap, j], `交换 arr[${j - gap}]=${a[j - gap]} 和 arr[${j}]=${a[j]}`, [...a], gap, group));

          [a[j - gap], a[j]] = [a[j], a[j - gap]];
          j -= gap;
        } else {
          break;
        }
      }
    }
  }

  const sortedIndices = Array.from({ length: n }, (_, i) => i);
  steps.push(createStep("sorted", sortedIndices, "排序完成"));
  return steps;
}

/** 桶排序（动态桶数：每 10 个元素一个桶，上限 9，与 useBucketSortRenderer.ts 保持一致） */
export function bucketSort(arr: number[]): SortStep[] {
  const steps: SortStep[] = [];
  const a = [...arr];
  const n = a.length;
  const K = calcBucketCount(n);
  const minV = Math.min(...a);
  const maxV = Math.max(...a);
  const range = maxV - minV + 1;

  // ── 分桶 ────────────────────────────────────────────────────────────
  const bkts: number[][] = Array.from({ length: K }, () => []);
  for (let i = 0; i < n; i++) {
    const bi = Math.min(K - 1, Math.floor(((a[i] - minV) / range) * K));
    steps.push(createStep(
      "bucket-scatter", [i],
      `分桶：将 arr[${i}]=${a[i]} 放入桶 ${bi}`,
      undefined, undefined, undefined, undefined,
      bi, bkts[bi].length,
    ));
    bkts[bi].push(a[i]);
  }

  // ── 桶内插入排序 ──────────────────────────────────────────────────
  for (let bi = 0; bi < K; bi++) {
    const b = bkts[bi];
    for (let i = 1; i < b.length; i++) {
      let j = i;
      while (j > 0) {
        steps.push(createStep(
          "bucket-compare", [j - 1, j],
          `桶 ${bi} 内排序：比较 ${b[j - 1]} 与 ${b[j]}`,
          undefined, undefined, undefined, undefined, bi,
        ));
        if (b[j - 1] > b[j]) {
          steps.push(createStep(
            "bucket-swap", [j - 1, j],
            `桶 ${bi} 内排序：交换 ${b[j - 1]} ↔ ${b[j]}`,
            undefined, undefined, undefined, undefined, bi,
          ));
          [b[j - 1], b[j]] = [b[j], b[j - 1]];
          j--;
        } else {
          break;
        }
      }
    }
  }

  // ── 收集归位 ──────────────────────────────────────────────────────
  const result = [...a];
  let gp = 0;
  for (let bi = 0; bi < K; bi++) {
    for (let k = 0; k < bkts[bi].length; k++) {
      result[gp] = bkts[bi][k];
      steps.push(createStep(
        "bucket-gather", [gp],
        `收集：桶 ${bi} 中的 ${bkts[bi][k]} 归位到 arr[${gp}]`,
        [...result], undefined, undefined, undefined, bi,
      ));
      gp++;
    }
  }

  steps.push(createStep("sorted", Array.from({ length: n }, (_, i) => i), "排序完成", [...result]));
  return steps;
}
