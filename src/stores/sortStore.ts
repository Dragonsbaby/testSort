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
  const animationSpeed = ref(500);
  const arraySize = ref(10);
  const algorithm = ref<SortAlgorithm>("quick");

  function generateArray(size: number) {
    const arr: ArrayElement[] = [];
    for (let i = 0; i < size; i++) arr.push({ value: Math.floor(Math.random() * 90) + 10, displayIndex: i + 1 });
    originalArray.value = [...arr];
  }

  function setSpeed(speed: number) { animationSpeed.value = speed; }
  function setAlgorithm(alg: SortAlgorithm) { algorithm.value = alg; }

  return { originalArray, animationSpeed, arraySize, algorithm, generateArray, setSpeed, setAlgorithm };
});