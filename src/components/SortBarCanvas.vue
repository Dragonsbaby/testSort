<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue";
import { useCanvasRenderer } from "@/composables/useCanvasRenderer";
import { getHeapRequiredHeight } from "@/utils/layout/heap-layout";
import type { CanvasVariant } from "@/components/canvas-variant";
import type { ArrayElement } from "@/stores/sortStore";
import type { FrameState } from "@/types/timeline";

/**
 * 统一 Canvas 壳：挂载/ResizeObserver/渲染循环 + 画框四角装饰。
 * variant 决定容器与画布的最小高度；heap 额外按元素数动态增高（可滚动）。
 * canvas-ready 载荷统一为 { width, height }。
 */
const props = withDefaults(
  defineProps<{
    variant?: CanvasVariant;
    /** 仅 heap 变体使用：按元素数计算所需高度 */
    array?: ArrayElement[];
  }>(),
  { variant: "basic" },
);

/** 各变体的静态尺寸规格（heap 为动态高度，不查此表） */
const CANVAS_SPEC: Record<Exclude<CanvasVariant, "heap">, { minHeight: number; canvasMinHeight: number }> = {
  basic: { minHeight: 280, canvasMinHeight: 300 },
  merge: { minHeight: 360, canvasMinHeight: 400 },
  bucket: { minHeight: 560, canvasMinHeight: 520 },
};

const emit = defineEmits<{ (e: "canvas-ready", size: { width: number; height: number }): void }>();

const containerRef = ref<HTMLDivElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);

const requiredHeight = computed(() =>
  props.variant === "heap" && props.array ? getHeapRequiredHeight(props.array.length) : 0,
);

const containerStyle = computed(() =>
  props.variant === "heap" ? { minHeight: `${requiredHeight.value}px` } : undefined,
);

function computeSize(rect: { width: number; height: number }) {
  const minHeight = props.variant === "heap"
    ? requiredHeight.value
    : CANVAS_SPEC[props.variant].canvasMinHeight;
  return { width: rect.width - 40, height: Math.max(minHeight, rect.height - 40) };
}

const { initialize, resize, renderFrame, startRenderLoop, stopRenderLoop } = useCanvasRenderer(canvasRef);

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  if (!containerRef.value) return;

  const rect = containerRef.value.getBoundingClientRect();
  const size = computeSize(rect);
  emit("canvas-ready", size);
  initialize(size.width, size.height);
  startRenderLoop();

  resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const next = computeSize(entry.contentRect);
      emit("canvas-ready", next);
      resize(next.width, next.height);
    }
  });
  resizeObserver.observe(containerRef.value);
});

onUnmounted(() => {
  stopRenderLoop();
  resizeObserver?.disconnect();
});

defineExpose({ renderFrame: (frame: FrameState) => renderFrame(frame) });
</script>

<template>
  <div class="sort-bar-canvas" :class="`v-${variant}`" :style="containerStyle" ref="containerRef">
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
  position: relative;
  z-index: 1;
}

/* 变体布局差异（原 4 个独立壳组件的样式合并） */
.v-basic {
  min-height: 280px;
  padding: 16px 22px;
}

.v-merge {
  min-height: 360px; /* 双排需要更多高度 */
  padding: 20px 20px 0 20px;
}

.v-bucket {
  min-height: 560px;
  padding: 20px 20px 0 20px;
}

.v-heap {
  padding: 20px 20px 0 20px;
  align-items: flex-start;
  overflow-y: auto;
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
  border-color: var(--border);
  border-style: solid;
  border-width: 0;
  z-index: 2;
  pointer-events: none;
  transition: border-color 0.3s ease;
}

.v-basic .corner {
  width: 28px;
  height: 28px;
}

.corner.top-left     { top: 0; left: 0;  border-top-width: 3px;    border-left-width: 3px;   border-top-left-radius: 8px; }
.corner.top-right    { top: 0; right: 0; border-top-width: 3px;    border-right-width: 3px;  border-top-right-radius: 8px; }
.corner.bottom-left  { bottom: 0; left: 0;  border-bottom-width: 3px; border-left-width: 3px;   border-bottom-left-radius: 8px; }
.corner.bottom-right { bottom: 0; right: 0; border-bottom-width: 3px; border-right-width: 3px;  border-bottom-right-radius: 8px; }
</style>
