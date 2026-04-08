<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, toRef } from 'vue';
import { useCanvasRenderer } from '@/composables/useCanvasRenderer';
import type { HighlightedIndices } from '@/composables/useCanvasRenderer';
import type { ArrayElement } from '@/stores/sortStore';

const props = defineProps<{ array: ArrayElement[]; highlightedIndices: HighlightedIndices; animationSpeed: number }>();

const containerRef = ref<HTMLDivElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const displayArray = toRef(props, 'array');
const highlighted = toRef(props, 'highlightedIndices');

const { barStates, initialize, resize, updateBars, startRenderLoop, stopRenderLoop, onStep } = useCanvasRenderer(canvasRef, displayArray, highlighted);

let resizeObserver: ResizeObserver | null = null;
let isApplyingStep = false; // 标记步骤动画执行中，防止 watcher 重复触发

onMounted(() => {
  if (containerRef.value) {
    const rect = containerRef.value.getBoundingClientRect();
    initialize(rect.width - 40, Math.max(300, rect.height - 40));
    startRenderLoop();
    resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        resize(width - 40, Math.max(300, height - 40));
      }
    });
    resizeObserver.observe(containerRef.value);
  }
});

onUnmounted(() => {
  stopRenderLoop();
  resizeObserver?.disconnect();
});

// 数组或高亮变化时更新柱子状态（步骤执行期间跳过）
watch(
  () => props.array,
  () => {
    if (!isApplyingStep) updateBars();
  },
  { deep: true }
);
watch(
  () => props.highlightedIndices,
  () => {
    if (!isApplyingStep) updateBars();
  },
  { deep: true }
);

// 执行排序步骤动画：swap/merge 驱动交换动画，compare/set 仅等待间隔
async function applyStep(step: { type: string; indices: number[]; arraySnapshot?: number[] }): Promise<number | undefined> {
  isApplyingStep = true;
  let delay: number | undefined;
  if (step.type === 'swap' || step.type === 'merge') {
    const oldPositions = new Map<number, number>();
    step.indices.forEach(idx => {
      const bar = barStates.value.find(b => b.index === idx);
      if (bar) oldPositions.set(bar.value, bar.x);
    });
    delay = await onStep(step as any, props.animationSpeed, oldPositions);
  } else if (step.type === 'compare' || step.type === 'set') {
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
  min-height: 280px;
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

.corner.top-left {
  top: 0;
  left: 0;
  border-top-width: 3px;
  border-left-width: 3px;
  border-top-left-radius: 8px;
}

.corner.top-right {
  top: 0;
  right: 0;
  border-top-width: 3px;
  border-right-width: 3px;
  border-top-right-radius: 8px;
}

.corner.bottom-left {
  bottom: 0;
  left: 0;
  border-bottom-width: 3px;
  border-left-width: 3px;
  border-bottom-left-radius: 8px;
}

.corner.bottom-right {
  bottom: 0;
  right: 0;
  border-bottom-width: 3px;
  border-right-width: 3px;
  border-bottom-right-radius: 8px;
}
</style>
