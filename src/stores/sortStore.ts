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
  const isPlaying = ref(false);
  const isComplete = ref(false);
  const animationSpeed = ref(200);
  const arraySize = ref(20);
  const algorithm = ref<SortAlgorithm>("quick");

  function generateArray(size: number) { // 生成随机数组
    const arr: ArrayElement[] = [];
    for (let i = 0; i < size; i++) arr.push({ value: Math.floor(Math.random() * 90) + 10, displayIndex: i + 1 });
    originalArray.value = [...arr];
  }

  function startSort() { isPlaying.value = true; } // 开始播放
  function pauseAnimation() { isPlaying.value = false; } // 暂停
  function stopAnimation() { pauseAnimation(); } // 停止（重置由算法组件自己处理）
  function setSpeed(speed: number) { animationSpeed.value = speed; }
  function setAlgorithm(alg: SortAlgorithm) { algorithm.value = alg; }

  return { originalArray, isPlaying, isComplete, animationSpeed, arraySize, algorithm, generateArray, startSort, pauseAnimation, stopAnimation, setSpeed, setAlgorithm };
});
