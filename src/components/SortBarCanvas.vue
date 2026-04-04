<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, toRef } from "vue";
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
  if (step.type === "swap" || step.type === "merge") {
    isApplyingStep = true;
    updateBars();
    onStep(step as any, props.animationSpeed);
    isApplyingStep = false;
  }
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
