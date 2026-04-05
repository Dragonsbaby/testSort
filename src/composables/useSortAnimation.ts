import { ref, watch, onUnmounted, computed, type Ref, type ToRef } from "vue";
import type { SortStep } from "@/types/sorting";
import type SortBarCanvas from "@/components/SortBarCanvas.vue";
import type { HighlightedIndices } from "@/composables/useCanvasRenderer";

type SortFn = (arr: number[]) => SortStep[];

function generateRandomArray(size: number): number[] {
  const arr: number[] = [];
  for (let i = 0; i < size; i++) arr.push(Math.floor(Math.random() * 90) + 10);
  return arr;
}

export function useSortAnimation(params: {
  sortFn: SortFn;
  isPlaying: ToRef<boolean>;
  speed: ToRef<number>;
  arraySize: ToRef<number>;
  canvasRef: Ref<InstanceType<typeof SortBarCanvas> | null>;
  originalArray: ToRef<number[]>;
}) {
  const { sortFn, isPlaying, speed, arraySize, canvasRef, originalArray } = params;

  const array = ref<number[]>([]);
  const steps = ref<SortStep[]>([]);
  const currentStep = ref(0);
  const comparisons = ref(0);
  const swaps = ref(0);
  const localPlaying = ref(false);
  let timer: ReturnType<typeof setTimeout> | null = null;

  // 增量维护 sortedIndices，避免 O(n) 遍历
  const sortedIndices = ref<Set<number>>(new Set());

  const highlightedIndices = computed<HighlightedIndices>(() => {
    if (currentStep.value <= 0 || currentStep.value > steps.value.length) return { comparing: [], swapping: [], sorted: [], pivot: [] };
    const step = steps.value[currentStep.value - 1];
    let comparing: number[] = [], swapping: number[] = [], pivot: number[] = [];
    switch (step.type) {
      case "compare": comparing = step.indices; break;
      case "swap":
      case "merge": swapping = step.indices; break;
      case "pivot": pivot = step.indices; break;
      case "set": swapping = step.indices; break;
    }
    return { comparing, swapping, sorted: Array.from(sortedIndices.value), pivot };
  });

  const currentStepInfo = computed(() => { if (currentStep.value <= 0 || currentStep.value > steps.value.length) return null; return steps.value[currentStep.value - 1]; });

  // 初始化数组：从 store 的 originalArray 拷贝
  function initFromOriginal() {
    if (array.value.length === 0 && originalArray.value.length > 0) {
      array.value = [...originalArray.value];
      steps.value = sortFn([...originalArray.value]);
      currentStep.value = 0;
      comparisons.value = 0;
      swaps.value = 0;
      sortedIndices.value = new Set();
      localPlaying.value = false;
    }
  }

  // 监听 store 的 originalArray 变化，自动初始化
  watch(originalArray, (newArr) => {
    if (newArr.length > 0 && array.value.length === 0) {
      initFromOriginal();
    }
  }, { immediate: true });

  function generateArray(size: number) { // 生成随机数组并预计算排序步骤
    stop();
    const arr = generateRandomArray(size);
    originalArray.value = [...arr]; // 更新 store
    array.value = [...arr];
    steps.value = sortFn([...arr]);
    currentStep.value = 0; comparisons.value = 0; swaps.value = 0; sortedIndices.value = new Set(); localPlaying.value = false;
  }

  function play() { if (steps.value.length === 0) return; localPlaying.value = true; step(); } // 开始连续播放

  async function step() { // 播放循环
    if (!localPlaying.value || currentStep.value >= steps.value.length) { localPlaying.value = false; return; }
    const delay = await applyStep(steps.value[currentStep.value]);
    timer = setTimeout(step, delay ?? speed.value);
  }

  async function applyStep(step: SortStep) { // 执行步骤：更新高亮、驱动动画、更新统计
    currentStep.value++;
    const animationDelay = await canvasRef.value?.applyStep(step);
    if (step.type === "compare") comparisons.value++;
    else if (step.type === "swap" || step.type === "merge" || step.type === "set") swaps.value++;
    else if (step.type === "sorted") step.indices.forEach(idx => sortedIndices.value.add(idx));
    if (currentStep.value >= steps.value.length) localPlaying.value = false;
    if (step.arraySnapshot) array.value = [...step.arraySnapshot];
    return animationDelay;
  }

  function stop() { localPlaying.value = false; if (timer) { clearTimeout(timer); timer = null; } } // 停止播放
  function reset() { stop(); currentStep.value = 0; comparisons.value = 0; swaps.value = 0; sortedIndices.value = new Set(); if (array.value.length > 0) array.value = [...array.value]; canvasRef.value?.updateBars(); } // 重置

  watch(isPlaying, (playing) => playing ? play() : stop()); // 响应外部 isPlaying 变化
  watch(speed, () => { if (localPlaying.value && currentStep.value < steps.value.length) { stop(); play(); } }); // 速度变化重启
  watch(arraySize, (size) => generateArray(size)); // 数组大小变化重生成

  onUnmounted(() => stop()); // 卸载时清理 timer

  async function stepOnce() { if (!localPlaying.value && currentStep.value < steps.value.length) await applyStep(steps.value[currentStep.value]); } // 单步执行

  return { array, steps, currentStep, comparisons, swaps, highlightedIndices, currentStepInfo, generateArray, reset, step: stepOnce };
}
