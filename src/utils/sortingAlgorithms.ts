import type { SortStep } from "@/types/sorting";

function createStep(
  type: SortStep["type"],
  indices: number[],
  description: string,
  arraySnapshot?: number[],
  gap?: number,
  groupIndices?: number[],
): SortStep {
  return { type, indices, description, arraySnapshot, gap, groupIndices };
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
      // 使用 swap 动画来展示元素右移
      steps.push(createStep("swap", [j, j + 1], `将 arr[${j}]=${array[j]} 右移到 arr[${j + 1}]`, [...array]));
      array[j + 1] = array[j];
      j--;
    }

    if (j >= 0) {
      steps.push(createStep("compare", [j, j + 1], `比较 arr[${j}]=${array[j]} 和 key=${key}`, [...array]));
    }

    // 将 key 插入到正确位置
    array[j + 1] = key;
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
    let i = 0,
      j = 0,
      k = left;

    steps.push(createStep("compare", [left, right], `合并区间 [${left}, ${mid}] 和 [${mid + 1}, ${right}]`, [...array]));

    while (i < leftArr.length && j < rightArr.length) {
      steps.push(createStep("compare", [left + i, mid + 1 + j], `比较 leftArr[${i}]=${leftArr[i]} 和 rightArr[${j}]=${rightArr[j]}`, [...array]));

      if (leftArr[i] <= rightArr[j]) {
        steps.push(createStep("set", [k], `将 ${leftArr[i]} 放到位置 ${k}`, [...array]));
        array[k] = leftArr[i];
        i++;
      } else {
        steps.push(createStep("set", [k], `将 ${rightArr[j]} 放到位置 ${k}`, [...array]));
        array[k] = rightArr[j];
        j++;
      }
      k++;
    }

    while (i < leftArr.length) {
      steps.push(createStep("set", [k], `将剩余 leftArr[${i}]=${leftArr[i]} 放到位置 ${k}`, [...array]));
      array[k] = leftArr[i];
      i++;
      k++;
    }

    while (j < rightArr.length) {
      steps.push(createStep("set", [k], `将剩余 rightArr[${j}]=${rightArr[j]} 放到位置 ${k}`, [...array]));
      array[k] = rightArr[j];
      j++;
      k++;
    }

    steps.push(createStep("merge", Array.from({ length: right - left + 1 }, (_, idx) => left + idx), `区间 [${left}, ${right}] 合并完成`, [...array]));
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
      const current = a[i];
      let j = i;
      while (j >= gap) {
        steps.push(createStep("compare", [j - gap, j], `比较间隔 ${gap} 内的元素 [${j - gap}]=${a[j - gap]} 和 [${j}]=${current}`, undefined, gap, group));
        if (a[j - gap] > current) {
          steps.push(createStep("swap", [j - gap, j], `间隔 ${gap} 移位：${a[j - gap]} 移到 [${j}]`, [...a], gap, group));
          a[j] = a[j - gap];
          j -= gap;
        } else {
          break;
        }
      }
      if (j !== i) {
        steps.push(createStep("swap", [j, i], `插入元素 ${current} 到位置 [${j}]`, [...a], gap, group));
        a[j] = current;
      }
    }
  }

  const sortedIndices = Array.from({ length: n }, (_, i) => i);
  steps.push(createStep("sorted", sortedIndices, "排序完成"));
  return steps;
}
