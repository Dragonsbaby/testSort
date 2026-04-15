import { ref, watch, onUnmounted, computed, type Ref, type ToRef } from 'vue';
import type { SortStep } from '@/types/sorting';
import type { HighlightedIndices } from '@/composables/useCanvasRenderer';

/**
 * Canvas 组件的最小接口
 * SortBarCanvas 和 SortBarCanvasMerge 均实现此接口，
 * 使 useSortAnimation 不与具体组件类型耦合
 */
export interface ISortCanvas {
  applyStep(step: SortStep): Promise<number | undefined>;
  updateBars(): void;
}

/** 排序函数类型：输入数组，输出排序步骤数组 */
type SortFn = (arr: number[]) => SortStep[];

/** 真正修改主数组内容的步骤类型（需重建 array 并调用 updateBars） */
const ARRAY_MUTATING_TYPES = new Set<SortStep['type']>(['swap', 'merge', 'set', 'merge-back']);

/**
 * 排序动画组合式函数
 * 封装排序动画的状态管理、步骤执行、播放控制
 *
 * @param params.sortFn - 排序算法函数
 * @param params.speed - 动画速度（毫秒）
 * @param params.canvasRef - Canvas 组件引用（实现 ISortCanvas 接口即可）
 * @param params.originalArray - 原始数组（用于重置）
 */
import type { ArrayElement } from "@/stores/sortStore";

export function useSortAnimation(params: { sortFn: SortFn; speed: ToRef<number>; canvasRef: Ref<ISortCanvas | null>; originalArray: ToRef<ArrayElement[]> }) {
  const { sortFn, speed, canvasRef, originalArray } = params;

  /** 当前显示的数组（步骤执行后可能与 originalArray 不同） */
  const array = ref<ArrayElement[]>([]);
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
  /** 上一步的完整高亮状态，交换步骤时继承所有状态 */
  let prevHighlightedIndices: HighlightedIndices = { comparing: [], swapping: [], sorted: [], pivot: [], pending: [] };

  /**
   * 缓存：value -> 所有对应 displayIndex 的映射
   *
   * 背景：arraySnapshot 只记录数值序列（如 [3, 1, 4, 3]），重建 ArrayElement[] 时
   * 需要知道每个值对应的 displayIndex（原始序号）。如果有重复值，必须按出现顺序
   * 逐一分配，不能混淆。
   *
   * 示例：originalArray = [{value:3, displayIndex:0}, {value:1, displayIndex:1},
   *                        {value:3, displayIndex:2}, {value:3, displayIndex:3}]
   * 构建后: Map(3) → [0, 2, 3], Map(1) → [1]
   */
  let valueToDisplayIndices: Map<number, number[]> | null = null;

  /**
   * 构建 value -> displayIndices 映射
   *
   * 在 initFromOriginal() 时构建一次并缓存，之后重建 snapshot 时复用。
   * 不需要每次步骤都重建，因为 originalArray 本身不会变。
   */
  function buildValueToDisplayIndices() {
    const map = new Map<number, number[]>();
    for (const el of originalArray.value) {
      const arr = map.get(el.value) ?? [];
      arr.push(el.displayIndex);
      map.set(el.value, arr);
    }
    return map;
  }

  /**
   * 根据当前步骤计算需要高亮的索引
   * @returns 各类高亮索引的对象，用于 Canvas 颜色渲染
   */
  const highlightedIndices = computed<HighlightedIndices>(() => {
    if (currentStep.value <= 0 || currentStep.value > steps.value.length) {
      return { comparing: [], swapping: [], sorted: [], pivot: [], pending: [] };
    }
    const step = steps.value[currentStep.value - 1];
    let comparing: number[] = [],
      swapping: number[] = [],
      pivot: number[] = [],
      pending: number[] = [];
    switch (step.type) {
      case 'compare':
        comparing = step.indices;
        pending = step.groupIndices ?? [];
        break;
      case 'swap':
      case 'merge':
        swapping = step.indices;
        // 交换/合并时继承上一步的所有高亮状态（comparing, pending, sorted, pivot）
        comparing = prevHighlightedIndices.comparing;
        pending = prevHighlightedIndices.pending;
        break;
      case 'pivot':
        pivot = step.indices;
        break;
      case 'set':
        swapping = step.indices;
        break;
      case 'merge-set':
        // 胜出元素正在飞向下排，清除比较高亮；保持 pending 范围不变
        comparing = [];
        pending = step.groupIndices ?? prevHighlightedIndices.pending;
        break;
      case 'merge-back':
        // 合并完成：清除所有上排高亮，由后续 sorted 步骤更新 sortedIndices
        comparing = []; pending = []; swapping = [];
        break;
      // "sorted" 类型不需要设置高亮，仅更新 sortedIndices
    }
    const sortedArray = Array.from(sortedIndices.value);
    // merge-set 继承上一步状态，不更新 prevHighlightedIndices
    if (step.type !== 'swap' && step.type !== 'merge' && step.type !== 'merge-set') {
      prevHighlightedIndices = { comparing, swapping, sorted: sortedArray, pivot, pending };
    }
    return { comparing, swapping, sorted: sortedArray, pivot, pending };
  });

  /** 当前步骤的详细信息（用于 UI 显示） */
  const currentStepInfo = computed(() => {
    if (currentStep.value <= 0 || currentStep.value > steps.value.length) return null;
    return steps.value[currentStep.value - 1];
  });

  /**
   * 只要 originalArray 更新就会要重载 数组和步骤
   */
  function initFromOriginal() {
    if (originalArray.value.length === 0) return;
    stop();
    array.value = [...originalArray.value];
    // 排序算法只接收数值数组
    steps.value = sortFn(originalArray.value.map(e => e.value));
    currentStep.value = 0;
    comparisons.value = 0;
    swaps.value = 0;
    sortedIndices.value = new Set();
    localPlaying.value = false;
    // 构建 value -> displayIndices 映射（只需构建一次）
    valueToDisplayIndices = buildValueToDisplayIndices();
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
    // 先等待动画完成，再递增 currentStep
    // 这样 highlightedIndices 的更新会与动画同步，避免比较高亮在动画结束前被清除
    const animationDelay = await canvasRef.value?.applyStep(step);

    // 动画完成后才更新 currentStep，让 highlightedIndices 与视觉状态一致
    currentStep.value++;

    if (step.type === 'compare') {
      comparisons.value++;
    } else if (step.type === 'swap' || step.type === 'merge' || step.type === 'set' ||
               step.type === 'merge-set' || step.type === 'merge-back') {
      swaps.value++;
    } else if (step.type === 'sorted') {
      step.indices.forEach(idx => sortedIndices.value.add(idx));
    }

    if (currentStep.value >= steps.value.length) {
      localPlaying.value = false;
    }
    // 只有真正修改主数组的步骤才需要重建 array 和调用 updateBars。
    // compare / pivot / sorted / merge-set 步骤中主数组未改变，跳过重建；
    // 否则 updateBars(clearQueue=true) 会清空 bottomBars / ghostTopIndices，
    // 导致正在飞行的下排柱子和幽灵占位被意外抹除。
    if (step.arraySnapshot && ARRAY_MUTATING_TYPES.has(step.type)) {
      // arraySnapshot 是 number[]，需要重建为 ArrayElement[]
      // 注意：对于 swap 步骤，arraySnapshot 是交换前的状态
      // 动画完成后，需要应用实际的交换来得到交换后的状态
      let finalSnapshot = step.arraySnapshot;
      if (step.type === 'swap' && step.indices.length === 2) {
        const [i, j] = step.indices;
        finalSnapshot = [...step.arraySnapshot];
        [finalSnapshot[i], finalSnapshot[j]] = [finalSnapshot[j], finalSnapshot[i]];
      }
      // 使用 round-robin 分配 displayIndex：遇到重复值时交替使用不同的序号
      // 例如 snapshot = [3, 3]，缓存 Map(3) = [0, 2] 时，
      // 第一个 3 分配 displayIndex=0，第二个 3 分配 displayIndex=2
      const roundRobin = new Map<number, number>();
      array.value = finalSnapshot.map(value => {
        const available = valueToDisplayIndices?.get(value) ?? [0];
        const idx = roundRobin.get(value) ?? 0;
        const displayIndex = available[idx % available.length];
        roundRobin.set(value, idx + 1);
        return { value, displayIndex };
      });
      // 同步更新 barStates，避免被下一步骤的 isApplyingStep 打断
      canvasRef.value?.updateBars();
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
   * 恢复原始数组，清除所有统计和步骤进度
   */
  function reset() {
    stop();
    array.value = [...originalArray.value];
    currentStep.value = 0;
    comparisons.value = 0;
    swaps.value = 0;
    sortedIndices.value = new Set();
    canvasRef.value?.updateBars();
  }

  // 监听 originalArray 变化，生成新数组并重置状态
  watch(originalArray, () => initFromOriginal(),{ immediate: true });

  // 速度变化时重启播放（确保使用新速度）
  watch(speed, () => {
    if (localPlaying.value && currentStep.value < steps.value.length) {
      stop();
      play();
    }
  });

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

  /** 状态文本 */
  const statusText = computed(() => {
    if (localPlaying.value) return '播放中';
    if (currentStep.value >= steps.value.length) return '已完成';
    if (currentStep.value === 0) return '就绪';
    return '已暂停';
  });

  /** 状态样式类 */
  const statusClass = computed(() => {
    if (localPlaying.value) return 'playing';
    if (currentStep.value >= steps.value.length) return 'done';
    if (currentStep.value === 0) return 'ready';
    return 'paused';
  });

  return {
    array,
    steps,
    currentStep,
    comparisons,
    swaps,
    highlightedIndices,
    currentStepInfo,
    isPlaying: localPlaying,
    play,
    pause: stop,
    step: stepOnce,
    reset,
    statusText,
    statusClass,
  };
}
