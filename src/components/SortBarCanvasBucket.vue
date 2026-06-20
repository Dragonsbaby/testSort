<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useCanvasRenderer } from '@/composables/useCanvasRenderer';
import type { ArrayElement } from '@/stores/sortStore';
import type { FrameState } from '@/types/timeline';

const props = defineProps<{
  array: ArrayElement[];
  animationSpeed: number;
}>();
void props;

const emit = defineEmits<{ (e: "canvas-ready", payload: { width: number; height: number }): void }>();

const containerRef = ref<HTMLDivElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);

const { initialize, resize, renderFrame, startRenderLoop, stopRenderLoop } = useCanvasRenderer(canvasRef);

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  if (containerRef.value) {
    const rect = containerRef.value.getBoundingClientRect();
    // 容器 min-height: 560px，减去上下 padding 40px，故 Canvas 最小高度为 520
    const actualHeight = Math.max(520, rect.height - 40);
    emit("canvas-ready", { width: rect.width - 40, height: actualHeight });
    initialize(rect.width - 40, actualHeight);
    startRenderLoop();
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const h = Math.max(520, height - 40);
        emit("canvas-ready", { width: width - 40, height: h });
        resize(width - 40, h);
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
  min-height: 560px;
  position: relative;
  padding: 20px 20px 0 20px;
  box-shadow: inset 0 0 60px rgba(78, 205, 196, 0.04);
  z-index: 1;
}

.sort-canvas {
  position: relative;
  z-index: 1;
}

/* Corner brackets */
.corner {
  position: absolute;
  width: 24px;
  height: 24px;
  border-color: rgba(78, 205, 196, 0.7);
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
