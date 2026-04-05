<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, toRef } from "vue";
import { useCanvasRenderer } from "@/composables/useCanvasRenderer";
import type { HighlightedIndices } from "@/composables/useCanvasRenderer";
import type { ArrayElement } from "@/stores/sortStore";

const props = defineProps<{ array: ArrayElement[]; highlightedIndices: HighlightedIndices; animationSpeed: number }>();

const containerRef = ref<HTMLDivElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const displayArray = toRef(props, "array");
const highlighted = toRef(props, "highlightedIndices");

const { barStates, initialize, resize, updateBars, startRenderLoop, stopRenderLoop, onStep } = useCanvasRenderer(canvasRef, displayArray, highlighted);

let resizeObserver: ResizeObserver | null = null;
let isApplyingStep = false; // 标记步骤动画执行中，防止 watcher 重复触发

onMounted(() => {
  if (containerRef.value) {
    const rect = containerRef.value.getBoundingClientRect();
    initialize(rect.width - 40, Math.max(300, rect.height - 40));
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

onUnmounted(() => { stopRenderLoop(); resizeObserver?.disconnect(); });

// 数组或高亮变化时更新柱子状态（步骤执行期间跳过）
watch(() => props.array, () => { if (!isApplyingStep) updateBars(); }, { deep: true });
watch(() => props.highlightedIndices, () => { if (!isApplyingStep) updateBars(); }, { deep: true });

// 执行排序步骤动画：swap/merge 驱动交换动画，compare/set 仅等待间隔
async function applyStep(step: { type: string; indices: number[]; arraySnapshot?: number[] }): Promise<number | undefined> {
  isApplyingStep = true;
  let delay: number | undefined;
  if (step.type === "swap" || step.type === "merge") {
    const oldPositions = new Map<number, number>();
    step.indices.forEach((idx) => { const bar = barStates.value.find((b) => b.index === idx); if (bar) oldPositions.set(bar.value, bar.x); });
    delay = await onStep(step as any, props.animationSpeed, oldPositions);
    if (step.arraySnapshot) displayArray.value = [...step.arraySnapshot];
  } else if (step.type === "compare" || step.type === "set") {
    delay = props.animationSpeed;
  }
  isApplyingStep = false;
  return delay;
}

defineExpose({ applyStep, updateBars });
</script>

<template>
  <div class="sort-bar-canvas" ref="containerRef"><canvas ref="canvasRef" class="sort-canvas" /></div>
</template>

<style scoped>
.sort-bar-canvas { flex: 1; display: flex; flex-direction: column; min-height: 300px; }
.sort-canvas { flex: 1; width: 100%; border-radius: 8px; }
</style>
