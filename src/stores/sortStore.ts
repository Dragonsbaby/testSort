import { defineStore } from "pinia";
import { ref } from "vue";
import type { SortAlgorithm } from "@/types/sorting";
import { getCompareMaxArraySize, COMPARE_ALGORITHMS } from "@/composables/useCompareUtils";

/** 数组元素：包含数值和固定序号 */
export interface ArrayElement {
  value: number;
  displayIndex: number; // 1-based 固定序号，随元素移动
}

export type ViewMode = 'single' | 'compare';
export type CompareLayout = 'horizontal' | 'vertical';

export const useSortStore = defineStore("sort", () => {
  // 状态
  const originalArray = ref<ArrayElement[]>([]);
  const animationSpeed = ref(200);
  const arraySize = ref(10);
  const algorithm = ref<SortAlgorithm>("heap");
  const viewMode = ref<ViewMode>('single');
  const compareLayout = ref<CompareLayout>('horizontal');
  const leftAlgorithm = ref<SortAlgorithm>('bubble');
  const rightAlgorithm = ref<SortAlgorithm>('quick');
  const savedAlgorithm = ref<SortAlgorithm | null>(null);
  const savedArraySize = ref<number | null>(null);
  const savedOriginalArray = ref<ArrayElement[] | null>(null);

  function generateArray(size: number) {
    // 生成 1-size 不重复的数并乱序
    const values = Array.from({ length: size }, (_, i) => i + 1);
    for (let i = values.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }
    const arr: ArrayElement[] = values.map((value, index) => ({ value, displayIndex: index + 1 }));
    originalArray.value = arr;
  }

  function setSpeed(speed: number) { animationSpeed.value = speed; }

  /** 设置数组规模并重新生成（原子操作，替代组件内 arraySize 赋值 + generateArray 两步） */
  function setArraySize(size: number) {
    arraySize.value = size;
    generateArray(size);
  }

  function setAlgorithm(alg: SortAlgorithm) { algorithm.value = alg; }
  function setViewMode(mode: ViewMode) { viewMode.value = mode; }
  function setCompareLayout(layout: CompareLayout) { compareLayout.value = layout; }
  function setLeftAlgorithm(alg: SortAlgorithm) { leftAlgorithm.value = alg; }
  function setRightAlgorithm(alg: SortAlgorithm) { rightAlgorithm.value = alg; }

  function enterCompareMode() {
    savedAlgorithm.value = algorithm.value;
    savedArraySize.value = arraySize.value;
    savedOriginalArray.value = JSON.parse(JSON.stringify(originalArray.value));
    leftAlgorithm.value = algorithm.value;
    const idx = COMPARE_ALGORITHMS.indexOf(algorithm.value);
    rightAlgorithm.value = COMPARE_ALGORITHMS[(idx + 1) % COMPARE_ALGORITHMS.length];
    const maxSize = getCompareMaxArraySize(leftAlgorithm.value, rightAlgorithm.value);
    if (arraySize.value > maxSize) {
      setArraySize(maxSize);
    }
    viewMode.value = 'compare';
  }

  function exitCompareMode() {
    viewMode.value = 'single';
    if (savedAlgorithm.value !== null) {
      algorithm.value = savedAlgorithm.value;
      savedAlgorithm.value = null;
    }
    if (savedOriginalArray.value !== null) {
      // 仅恢复 arraySize 计数，不重新生成（originalArray 已在上行恢复）
      originalArray.value = savedOriginalArray.value;
      arraySize.value = savedOriginalArray.value.length;
      savedOriginalArray.value = null;
    }
    savedArraySize.value = null;
  }

  return { originalArray, animationSpeed, arraySize, algorithm, generateArray, setSpeed, setArraySize, setAlgorithm,
    viewMode, compareLayout, leftAlgorithm, rightAlgorithm,
    savedAlgorithm, savedArraySize,
    setViewMode, setCompareLayout, setLeftAlgorithm, setRightAlgorithm,
    enterCompareMode, exitCompareMode,
  };
});
