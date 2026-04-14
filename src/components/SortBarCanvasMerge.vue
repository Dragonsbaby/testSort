<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, toRef } from 'vue';
import { useMergeSortRenderer } from '@/composables/useMergeSortRenderer';
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
  setActiveMergeRange,
  updateTempBars,
  clearTempBars,
} = useMergeSortRenderer(canvasRef, displayArray, highlighted);

let resizeObserver: ResizeObserver | null = null;
/** 步骤动画执行中，防止 watcher 重复触发 updateBars */
let isApplyingStep = false;

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
  () => { if (!isApplyingStep) updateBars(); },
  { deep: true },
);
watch(
  () => props.highlightedIndices,
  () => { if (!isApplyingStep) updateColors(); },
  { deep: true },
);

/**
 * 执行一个排序步骤，驱动上排/下排视觉更新
 *
 * - compare（含 groupIndices）: 设置下排合并区间 + 同步 temp 空槽显示
 * - merge-set              : 将元素放入下排对应位置
 * - merge-back             : 清空下排，上排刷新
 * - swap                   : 标准交换动画（归并排序不产生，预留兼容）
 * - 其余类型（sorted/pivot）: 仅等待间隔
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

  } else if (step.type === 'compare') {
    // 有 groupIndices 代表这是合并阶段的 compare（分割阶段的 compare 没有 groupIndices）
    if (step.groupIndices && step.groupIndices.length > 0 && step.tempSnapshot !== undefined) {
      const left  = Math.min(...step.groupIndices);
      const right = Math.max(...step.groupIndices);
      setActiveMergeRange([left, right]);
      updateTempBars(step.tempSnapshot);
    }
    delay = props.animationSpeed;

  } else if (step.type === 'merge-set') {
    // 将元素放入下排辅助区
    if (step.tempSnapshot) {
      // step.indices[0] 是本次刚放入的位置，用于橙色高亮
      updateTempBars(step.tempSnapshot, step.indices[0]);
    }
    delay = props.animationSpeed;

  } else if (step.type === 'merge-back') {
    // 合并完成：清空下排，上排由 useSortAnimation 更新 displayArray 后 watcher 触发 updateBars
    clearTempBars();
    setActiveMergeRange(null);
    delay = props.animationSpeed;

  } else {
    // set / merge / sorted / pivot 等：仅等待间隔
    delay = props.animationSpeed;
  }

  isApplyingStep = false;
  return delay;
}

defineExpose({ applyStep, updateBars });
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
