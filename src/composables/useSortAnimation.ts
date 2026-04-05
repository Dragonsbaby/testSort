import { ref, watch, onUnmounted, computed, type Ref, type ToRef } from "vue";
import type { SortStep } from "@/types/sorting";
import type SortBarCanvas from "@/components/SortBarCanvas.vue";
import type { HighlightedIndices } from "@/composables/useCanvasRenderer";

/** 排序函数类型：输入数组，输出排序步骤数组 */
type SortFn = (arr: number[]) => SortStep[];

/**
 * 生成随机数组（数值范围 10-99）
 * @param size 数组大小
 */
function generateRandomArray(size: number): number[] {
  const arr: number[] = [];
  for (let i = 0; i < size; i++) arr.push(Math.floor(Math.random() * 90) + 10);
  return arr;
}

/**
 * 排序动画组合式函数
 * 封装排序动画的状态管理、步骤执行、播放控制
 *
 * @param params.sortFn - 排序算法函数
 * @param params.isPlaying - 外部播放状态（响应式）
 * @param params.speed - 动画速度（毫秒）
 * @param params.arraySize - 数组大小
 * @param params.canvasRef - Canvas 组件引用
 * @param params.originalArray - 原始数组（用于重置）
 */
export function useSortAnimation(params: {
  sortFn: SortFn;
  isPlaying: ToRef<boolean>;
  speed: ToRef<number>;
  arraySize: ToRef<number>;
  canvasRef: Ref<InstanceType<typeof SortBarCanvas> | null>;
  originalArray: ToRef<number[]>;
}) {
  const { sortFn, isPlaying, speed, arraySize, canvasRef, originalArray } = params;

  /** 当前显示的数组（步骤执行后可能与 originalArray 不同） */
  const array = ref<number[]>([]);
  /** 预计算的排序步骤数组 */
  const steps = ref<SortStep[]>([]);
  /** 当前步骤索引（0 表示未开始） */
  const currentStep = ref(0);
  /** 比较次数统计 */
  const comparisons = ref(0);
  /** 交换/合并次数统计 */
  const swaps = ref(0);
  /** 内部播放状态（独立于 isPlaying，允许单步执行） */
  const localPlaying = ref(false);
  /** setTimeout 定时器 ID */
  let timer: ReturnType<typeof setTimeout> | null = null;

  /** 已排序元素的索引集合（增量维护，避免 O(n) 遍历） */
  const sortedIndices = ref<Set<number>>(new Set());

  /**
   * 根据当前步骤计算需要高亮的索引
   * @returns 各类高亮索引的对象，用于 Canvas 颜色渲染
   */
  const highlightedIndices = computed<HighlightedIndices>(() => {
    if (currentStep.value <= 0 || currentStep.value > steps.value.length) {
      return { comparing: [], swapping: [], sorted: [], pivot: [] };
    }
    const step = steps.value[currentStep.value - 1];
    let comparing: number[] = [], swapping: number[] = [], pivot: number[] = [];
    switch (step.type) {
      case "compare": comparing = step.indices; break;
      case "swap":
      case "merge": swapping = step.indices; break;
      case "pivot": pivot = step.indices; break;
      case "set": swapping = step.indices; break;
      // "sorted" 类型不需要设置高亮，仅更新 sortedIndices
    }
    return { comparing, swapping, sorted: Array.from(sortedIndices.value), pivot };
  });

  /** 当前步骤的详细信息（用于 UI 显示） */
  const currentStepInfo = computed(() => {
    if (currentStep.value <= 0 || currentStep.value > steps.value.length) return null;
    return steps.value[currentStep.value - 1];
  });

  /**
   * 从 originalArray 初始化数组和步骤
   * 仅在 array 为空且 originalArray 有值时执行
   */
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

  // 监听 originalArray 变化，自动初始化
  watch(originalArray, (newArr) => {
    if (newArr.length > 0 && array.value.length === 0) {
      initFromOriginal();
    }
  }, { immediate: true });

  /**
   * 生成新的随机数组并预计算排序步骤
   * @param size 数组大小
   */
  function generateArray(size: number) {
    stop();
    const arr = generateRandomArray(size);
    originalArray.value = [...arr]; // 更新 store
    array.value = [...arr];
    steps.value = sortFn([...arr]);
    currentStep.value = 0;
    comparisons.value = 0;
    swaps.value = 0;
    sortedIndices.value = new Set();
    localPlaying.value = false;
  }

  /** 开始连续播放 */
  function play() {
    if (steps.value.length === 0) return;
    localPlaying.value = true;
    step();
  }

  /** 播放循环：执行一步，等待动画完成，继续下一步 */
  async function step() {
    if (!localPlaying.value || currentStep.value >= steps.value.length) {
      localPlaying.value = false;
      return;
    }
    const delay = await applyStep(steps.value[currentStep.value]);
    timer = setTimeout(step, delay ?? speed.value);
  }

  /**
   * 执行单个排序步骤
   * 1. 调用 Canvas 的 applyStep 驱动动画
   * 2. 更新统计计数
   * 3. 更新 sortedIndices
   * 4. 更新 array（如有快照）
   * @returns 动画延迟时间
   */
  async function applyStep(step: SortStep) {
    currentStep.value++;
    const animationDelay = await canvasRef.value?.applyStep(step);

    if (step.type === "compare") {
      comparisons.value++;
    } else if (step.type === "swap" || step.type === "merge" || step.type === "set") {
      swaps.value++;
    } else if (step.type === "sorted") {
      step.indices.forEach(idx => sortedIndices.value.add(idx));
    }

    if (currentStep.value >= steps.value.length) {
      localPlaying.value = false;
    }
    if (step.arraySnapshot) {
      array.value = [...step.arraySnapshot];
    }
    return animationDelay;
  }

  /** 停止播放，清除定时器 */
  function stop() {
    localPlaying.value = false;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  /**
   * 重置到初始状态
   * 注意：array 不重置为 originalArray，而是保持当前值（可能已被步骤修改）
   */
  function reset() {
    stop();
    currentStep.value = 0;
    comparisons.value = 0;
    swaps.value = 0;
    sortedIndices.value = new Set();
    if (array.value.length > 0) array.value = [...array.value];
    canvasRef.value?.updateBars();
  }

  // 响应外部 isPlaying 变化
  watch(isPlaying, (playing) => playing ? play() : stop());

  // 速度变化时重启播放（确保使用新速度）
  watch(speed, () => {
    if (localPlaying.value && currentStep.value < steps.value.length) {
      stop();
      play();
    }
  });

  // 数组大小变化时重新生成
  watch(arraySize, (size) => generateArray(size));

  // 卸载时清理定时器
  onUnmounted(() => stop());

  /**
   * 单步执行（不依赖 isPlaying）
   * 用于手动单步控制
   */
  async function stepOnce() {
    if (!localPlaying.value && currentStep.value < steps.value.length) {
      await applyStep(steps.value[currentStep.value]);
    }
  }

  return {
    array,
    steps,
    currentStep,
    comparisons,
    swaps,
    highlightedIndices,
    currentStepInfo,
    generateArray,
    reset,
    step: stepOnce,
  };
}
