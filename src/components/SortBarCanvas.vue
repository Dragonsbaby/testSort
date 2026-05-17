<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useCanvasRenderer } from "@/composables/useCanvasRenderer";
import type { ArrayElement } from "@/stores/sortStore";
import type { FrameState } from "@/types/timeline";

const props = defineProps<{ array: ArrayElement[]; animationSpeed: number }>();
void props;

const emit = defineEmits<{ (e: "canvas-ready", width: number): void }>();

const containerRef = ref<HTMLDivElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const canvasWidth = ref(760);

const { initialize, resize, renderFrame, startRenderLoop, stopRenderLoop } = useCanvasRenderer(canvasRef);

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  if (!containerRef.value) return;

  const rect = containerRef.value.getBoundingClientRect();
  canvasWidth.value = rect.width - 40;
  emit("canvas-ready", canvasWidth.value);
  initialize(canvasWidth.value, Math.max(300, rect.height - 40));
  startRenderLoop();

  resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const { width, height } = entry.contentRect;
      canvasWidth.value = width - 40;
      emit("canvas-ready", canvasWidth.value);
      resize(canvasWidth.value, Math.max(300, height - 40));
    }
  });
  resizeObserver.observe(containerRef.value);
});

onUnmounted(() => {
  stopRenderLoop();
  resizeObserver?.disconnect();
});

function exposedRenderFrame(frame: FrameState) {
  renderFrame(frame);
}

defineExpose({ renderFrame: exposedRenderFrame, canvasWidth });
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
  padding: 16px 22px;
  z-index: 1;
}

.sort-canvas {
  position: relative;
  z-index: 1;
}

.corner {
  position: absolute;
  width: 28px;
  height: 28px;
  border-color: rgba(74, 158, 255, 0.9);
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
