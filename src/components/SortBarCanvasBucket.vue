<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useBucketSortRenderer } from '@/composables/useBucketSortRenderer';
import type { ArrayElement } from '@/stores/sortStore';
import type { SortStep } from '@/types/sorting';

const props = defineProps<{
  array: ArrayElement[];
  animationSpeed: number;
}>();

const containerRef = ref<HTMLDivElement | null>(null);
const canvasRef    = ref<HTMLCanvasElement | null>(null);

// 将 props.array 包装为 Ref 传给渲染器
const displayArray = ref(props.array);
watch(() => props.array, val => { displayArray.value = val; }, { deep: true });

const { initialize, resize, updateBars, forceReset, startRenderLoop, stopRenderLoop, applyStep: rendererApplyStep } =
  useBucketSortRenderer(canvasRef, displayArray);

let resizeObserver: ResizeObserver | null = null;
/** 步骤执行中标志，防止 array watch 误触发 forceReset */
let isApplyingStep = false;

onMounted(() => {
  if (containerRef.value) {
    const rect = containerRef.value.getBoundingClientRect();
    initialize(rect.width - 40, Math.max(420, rect.height - 40));
    startRenderLoop();
    resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        resize(width - 40, Math.max(420, height - 40));
      }
    });
    resizeObserver.observe(containerRef.value);
  }
});

onUnmounted(() => {
  stopRenderLoop();
  resizeObserver?.disconnect();
});

// array prop 变化时重置（仅在非动画期间触发，对应重置操作）
watch(
  () => props.array,
  () => { if (!isApplyingStep) forceReset(); },
  { deep: true },
);

/** 执行单个步骤，暴露给 useSortAnimation（ISortCanvas 接口） */
async function applyStep(step: SortStep): Promise<number | undefined> {
  isApplyingStep = true;
  const delay = await rendererApplyStep(step, props.animationSpeed);
  isApplyingStep = false;
  return delay;
}

/**
 * 暴露给 useSortAnimation 的 updateBars 入口。
 * 直接调用 forceReset() 绕过 bucketStateActive 守卫，确保上一步回退时状态完整重建。
 */
function exposedUpdateBars() {
  forceReset();
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
  min-height: 420px;
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
