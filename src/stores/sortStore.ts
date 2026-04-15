import { defineStore } from "pinia";
import { ref } from "vue";
import type { SortAlgorithm } from "@/types/sorting";

/** 数组元素：包含数值和固定序号 */
export interface ArrayElement {
  value: number;
  displayIndex: number; // 1-based 固定序号，随元素移动
}

export const useSortStore = defineStore("sort", () => {
  // 状态
  const originalArray = ref<ArrayElement[]>([]);
  const animationSpeed = ref(200);
  const arraySize = ref(10);
  const algorithm = ref<SortAlgorithm>("quick");

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
  function setAlgorithm(alg: SortAlgorithm) { algorithm.value = alg; }

  return { originalArray, animationSpeed, arraySize, algorithm, generateArray, setSpeed, setAlgorithm };
});