<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, toRef, nextTick } from "vue";
import { useSortStore } from "../stores/sortStore";
import { useCanvasRenderer } from "../composables/useCanvasRenderer";

const store = useSortStore();
const containerRef = ref<HTMLDivElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);

const displayArray = toRef(store, "displayArray");
const highlightedIndices = toRef(store, "highlightedIndices");

const {
  initialize,
  resize,
  updateBars,
  startRenderLoop,
  stopRenderLoop,
  onStep,
} = useCanvasRenderer(canvasRef, displayArray, highlightedIndices);

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
  () => store.displayArray,
  () => {
    if (!isApplyingStep) {
      updateBars();
    }
  },
  { deep: true },
);

watch(
  () => store.currentStepInfo,
  async (step) => {
    if (step && (step.type === "swap" || step.type === "merge")) {
      isApplyingStep = true;
      await nextTick();
      updateBars();
      await nextTick();
      onStep(step, store.animationSpeed);
      isApplyingStep = false;
    }
  },
);
</script>

<template>
  <div class="visualizer" ref="containerRef">
    <canvas ref="canvasRef" class="sort-canvas" />
  </div>
</template>

<style scoped>
.visualizer {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
  border-radius: 12px;
  padding: 20px;
  min-height: 400px;
  overflow: hidden;
}

.sort-canvas {
  flex: 1;
  width: 100%;
  border-radius: 8px;
}
</style>
