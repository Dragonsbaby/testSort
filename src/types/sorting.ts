export type StepType =
  | "compare"
  | "swap"
  | "merge"
  | "set"
  | "sorted"
  | "pivot";

export interface SortStep {
  type: StepType;
  indices: number[];
  description: string;
  arraySnapshot?: number[];
}

export type SortAlgorithm = "bubble" | "insertion" | "merge" | "quick" | "shell";

export interface AlgorithmInfo {
  name: string;
  description: string;
  complexity: string;
}

export const algorithmInfo: Record<SortAlgorithm, AlgorithmInfo> = {
  bubble: {
    name: "冒泡排序",
    description: '通过相邻元素比较和交换，逐步将最大元素"冒泡"到数组末端',
    complexity: "O(n²)",
  },
  insertion: {
    name: "插入排序",
    description: "将数组分为有序区和无序区，逐个将无序区元素插入有序区",
    complexity: "O(n²)",
  },
  merge: {
    name: "归并排序",
    description: "分治策略，将数组分割后递归排序，再合并有序子数组",
    complexity: "O(n log n)",
  },
  quick: {
    name: "快速排序",
    description: "分治策略，选择基准元素，将数组分为小于和大于基准的两部分",
    complexity: "O(n log n)",
  },
  shell: {
    name: "希尔排序",
    description: "希尔排序是插入排序的改进版本，通过设置间隔序列逐步缩小排序范围。",
    complexity: "O(n log² n)",
  },
};
