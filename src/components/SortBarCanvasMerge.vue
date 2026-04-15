<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, toRef } from 'vue';
import { useMergeSortRenderer, COLORS } from '@/composables/useMergeSortRenderer';
import type { HighlightedIndices } from '@/composables/useCanvasRenderer';
import type { ArrayElement } from '@/stores/sortStore';
import type { SortStep } from '@/types/sorting';

const props = defineProps<{
  array: ArrayElement[];
  highlightedIndices: HighlightedIndices;
  animationSpeed: number;
}>();

const containerRef = ref<HTMLDivElement | null>(null);
const canvasRef    = ref<HTMLCanvasElement | null>(null);
const displayArray = toRef(props, 'array');
const highlighted  = toRef(props, 'highlightedIndices');

const {
  barStates,
  initialize,
  resize,
  updateBars,
  updateColors,
  startRenderLoop,
  stopRenderLoop,
  onStep,
  moveBarDown,
  moveAllBarsUp,
} = useMergeSortRenderer(canvasRef, displayArray, highlighted);

let resizeObserver: ResizeObserver | null = null;
/** 步骤动画执行中，防止 watcher 重复触发 updateBars */
let isApplyingStep = false;
/**
 * merge-back 完成后，记录需要强制使用的初始颜色（COLORS.sorted 绿色）。
 * 保持到 highlightedIndices 发生变化（说明进入下一步骤），届时清零。
 * 不能在第一次调用后立即清零，因为 watch 可能用新 displayArray 再次触发 updateBars，
 * 而那次调用同样需要用绿色初始化。
 */
let mergeBackPendingColor: typeof COLORS.sorted | undefined;

onMounted(() => {
  if (containerRef.value) {
    const rect = containerRef.value.getBoundingClientRect();
    initialize(rect.width - 40, Math.max(400, rect.height - 40));
    startRenderLoop();
    resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        resize(width - 40, Math.max(400, height - 40));
      }
    });
    resizeObserver.observe(containerRef.value);
  }
});

onUnmounted(() => {
  stopRenderLoop();
  resizeObserver?.disconnect();
});

// 主数组或高亮变化时刷新上排（步骤执行期间跳过，避免与动画冲突）
watch(
  () => props.array,
  () => { if (!isApplyingStep) exposedUpdateBars(); },
  { deep: true },
);
watch(
  () => props.highlightedIndices,
  () => {
    // highlightedIndices 变化说明进入了新步骤，merge-back 的绿色保护结束
    mergeBackPendingColor = undefined;
    if (!isApplyingStep) updateColors();
  },
  { deep: true },
);

/**
 * 执行一个排序步骤，驱动上排/下排视觉更新
 *
 * - compare（含 groupIndices）: 高亮上排两个待比较元素（无额外操作）
 * - merge-set [sourceIndex, destIndex]: 胜出元素从上排飞到下排
 * - merge-back               : 下排所有元素并行飞回上排
 * - swap                     : 标准交换动画（归并排序不产生，预留兼容）
 * - 其余类型                 : 仅等待间隔
 */
async function applyStep(step: SortStep): Promise<number | undefined> {
  isApplyingStep = true;
  let delay: number | undefined;

  if (step.type === 'swap') {
    // 标准交换动画（归并排序不产生此类型，保留兼容性）
    const oldPositions = new Map<number, number>();
    step.indices.forEach(idx => {
      const bar = barStates.value.find(b => b.index === idx);
      if (bar) oldPositions.set(bar.value, bar.x);
    });
    delay = await onStep(step, props.animationSpeed, oldPositions) as number | undefined;

  } else if (step.type === 'merge-set') {
    // indices[0] = 源（上排索引），indices[1] = 目标（下排输出列）
    const [sourceIndex, destIndex] = step.indices;
    delay = await moveBarDown(sourceIndex, destIndex, props.animationSpeed);

  } else if (step.type === 'merge-back') {
    // 下排全部元素一起飞回上排
    delay = await moveAllBarsUp(props.animationSpeed);
    // 标记：后续 updateBars 需要用绿色初始化，直到 highlightedIndices 变化（进入下一步骤）
    mergeBackPendingColor = COLORS.sorted;

  } else {
    // compare / sorted / pivot / set 等：仅等待间隔
    delay = props.animationSpeed;
  }

  isApplyingStep = false;
  return delay;
}

/**
 * 暴露给 useSortAnimation 的 updateBars 入口。
 * 若处于 merge-back 完成后的状态（mergeBackPendingColor 非空），
 * 传入绿色作为初始颜色，避免 round-robin displayIndex 不连续导致
 * 颜色继承失败（sorted 绿色闪变蓝色的视觉抖动）。
 * mergeBackPendingColor 不会在此处清零，而是等到 highlightedIndices
 * 变化时（进入新步骤）由 watch 清零，确保多次 updateBars 调用（直接调用
 * 和 watch 触发）都能获得正确的绿色初始化。
 */
function exposedUpdateBars() {
  updateBars(true, mergeBackPendingColor);
}

defineExpose({ applyStep, updateBars: exposedUpdateBars });
</script>

<template>
  <div class="sort-bar-canvas" ref="containerRef">
    <canvas ref="canvasRef" class="sort-canvas" />
    <div class="corner top-left"></div>
    <div class="corner top-right"></div>
    <div class="corner bottom-left"></div>
    <div class="corner bottom-right"></div>
  </div>
</template>

<style lang="scss" scoped>
.sort-bar-canvas {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 360px;   /* 双排需要更多高度 */
  position: relative;
  padding: 20px 20px 0 20px;
}

/* Corner brackets */
.corner {
  position: absolute;
  width: 24px;
  height: 24px;
  border-color: rgba(74, 158, 255, 0.8);
  border-style: solid;
  border-width: 0;
  z-index: 2;
  pointer-events: none;
  transition: border-color 0.3s ease;
}
.corner.top-left    { top: 0; left: 0;  border-top-width: 3px;    border-left-width: 3px;  border-top-left-radius: 8px; }
.corner.top-right   { top: 0; right: 0; border-top-width: 3px;    border-right-width: 3px; border-top-right-radius: 8px; }
.corner.bottom-left { bottom: 0; left: 0;  border-bottom-width: 3px; border-left-width: 3px;  border-bottom-left-radius: 8px; }
.corner.bottom-right{ bottom: 0; right: 0; border-bottom-width: 3px; border-right-width: 3px; border-bottom-right-radius: 8px; }
</style>
