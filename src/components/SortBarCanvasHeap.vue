<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue";
import { useCanvasRenderer } from "@/composables/useCanvasRenderer";
import { getHeapRequiredHeight } from "@/utils/layout/heap-layout";
import type { ArrayElement } from "@/stores/sortStore";
import type { FrameState } from "@/types/timeline";

const props = defineProps<{
  array: ArrayElement[];
  animationSpeed: number;
}>();
void props;

const emit = defineEmits<{ (e: "canvas-ready", width: number): void }>();

const containerRef = ref<HTMLDivElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const requiredHeight = computed(() => getHeapRequiredHeight(props.array.length));

const { initialize, resize, renderFrame, startRenderLoop, stopRenderLoop } = useCanvasRenderer(canvasRef);

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  if (containerRef.value) {
    const rect = containerRef.value.getBoundingClientRect();
    emit("canvas-ready", rect.width - 40);
    initialize(rect.width - 40, Math.max(requiredHeight.value, rect.height - 40));
    startRenderLoop();
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        emit("canvas-ready", width - 40);
        resize(width - 40, Math.max(requiredHeight.value, height - 40));
      }
    });
    resizeObserver.observe(containerRef.value);
  }
});

onUnmounted(() => {
  stopRenderLoop();
  resizeObserver?.disconnect();
});

function exposedRenderFrame(frame: FrameState) {
  renderFrame(frame);
}

defineExpose({ renderFrame: exposedRenderFrame });
</script>

<template>
  <div class="sort-bar-canvas" ref="containerRef" :style="{ minHeight: `${requiredHeight}px` }">
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
  align-items: flex-start;
  justify-content: center;
  position: relative;
  padding: 20px 20px 0 20px;
  overflow-y: auto;
  z-index: 1;
}

.sort-canvas {
  position: relative;
  z-index: 1;
}

.corner {
  position: absolute;
  width: 24px;
  height: 24px;
  border-color: rgba(74, 158, 255, 0.8);
  border-style: solid;
  border-width: 0;
  z-index: 2;
  pointer-events: none;
}

.corner.top-left    { top: 0;    left: 0;  border-top-width: 3px;    border-left-width: 3px;   border-top-left-radius: 8px; }
.corner.top-right   { top: 0;    right: 0; border-top-width: 3px;    border-right-width: 3px;  border-top-right-radius: 8px; }
.corner.bottom-left { bottom: 0; left: 0;  border-bottom-width: 3px; border-left-width: 3px;   border-bottom-left-radius: 8px; }
.corner.bottom-right{ bottom: 0; right: 0; border-bottom-width: 3px; border-right-width: 3px;  border-bottom-right-radius: 8px; }
</style>
