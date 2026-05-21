import type { SortAlgorithm } from "@/types/sorting";

type AlgorithmCategory = 'simple' | 'medium' | 'complex';

const ALGORITHM_CATEGORIES: Record<SortAlgorithm, AlgorithmCategory> = {
  bubble: 'simple',
  insertion: 'simple',
  quick: 'simple',
  shell: 'simple',
  merge: 'medium',
  bucket: 'complex',
  heap: 'complex',
};

/** 根据两侧算法组合返回元素数量上限 */
export function getCompareMaxArraySize(algA: SortAlgorithm, algB: SortAlgorithm): number {
  const catA = ALGORITHM_CATEGORIES[algA];
  const catB = ALGORITHM_CATEGORIES[algB];
  if (catA === 'complex' && catB === 'complex') return 25;
  if (catA === 'complex' || catB === 'complex') return 40;
  if (catA === 'medium' || catB === 'medium') return 60;
  return 100;
}

/** 获取所有可选算法列表 */
export const COMPARE_ALGORITHMS: SortAlgorithm[] = [
  'bubble', 'insertion', 'quick', 'shell', 'merge', 'bucket', 'heap',
];
