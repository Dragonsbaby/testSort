<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, toRef, nextTick } from "vue";
import { useCanvasRenderer } from "@/composables/useCanvasRenderer";
import type { HighlightedIndices } from "@/composables/useCanvasRenderer";

const props = defineProps<{
  array: number[];
  highlightedIndices: HighlightedIndices;
  animationSpeed: number;
}>();

const containerRef = ref<HTMLDivElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);

const displayArray = toRef(props, "array");
const highlighted = toRef(props, "highlightedIndices");

const {
  barStates,
  initialize,
  resize,
  updateBars,
  startRenderLoop,
  stopRenderLoop,
  onStep,
} = useCanvasRenderer(canvasRef, displayArray, highlighted);

let resizeObserver: ResizeObserver | null = null;
let isApplyingStep = false;

onMounted(() => {
  if (containerRef.value) {
    const rect = containerRef.value.getBoundingClientRect();
    const width = rect.width - 40;
    const height = rect.height - 40;
    initialize(width, Math.max(300, height));
    startRenderLoop();

    resizeObserver = new ResizeObserver((entries) => {
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

watch(
  () => props.array,
  () => {
    if (!isApplyingStep) {
      updateBars();
    }
  },
  { deep: true },
);

watch(
  () => props.highlightedIndices,
  () => {
    if (!isApplyingStep) {
      updateBars();
    }
  },
  { deep: true },
);

function applyStep(step: { type: string; indices: number[]; arraySnapshot?: number[] }) {
  // 对于所有步骤类型，都设置标志防止 watcher 干扰
  isApplyingStep = true;

  if (step.type === "swap" || step.type === "merge") {
    // 保存旧位置必须在 updateBars 之前，否则柱子已经跳到新位置了
    const oldPositions = new Map<number, number>();
    step.indices.forEach((idx) => {
      const bar = barStates.value.find((b) => b.index === idx);
      if (bar) oldPositions.set(bar.value, bar.x);
    });
    // 先排队动画（此时柱子还在旧位置）
    onStep(step as any, props.animationSpeed, oldPositions);
    // 再更新显示数组（触发 watcher 调用 updateBars）
    if (step.arraySnapshot) {
      displayArray.value = [...step.arraySnapshot];
    }
  }

  // 延迟重置标志，让 watcher 完成后再重置
  nextTick(() => {
    isApplyingStep = false;
  });
}

defineExpose({ applyStep, updateBars });
</script>

<template>
  <div class="sort-bar-canvas" ref="containerRef">
    <canvas ref="canvasRef" class="sort-canvas" />
  </div>
</template>

<style scoped>
.sort-bar-canvas {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 300px;
}

.sort-canvas {
  flex: 1;
  width: 100%;
  border-radius: 8px;
}
</style>
