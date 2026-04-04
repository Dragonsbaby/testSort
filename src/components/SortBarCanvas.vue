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
let watchingDisabled = false;

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
    if (!isApplyingStep && !watchingDisabled) {
      updateBars();
    }
  },
  { deep: true },
);

watch(
  () => props.highlightedIndices,
  () => {
    if (!isApplyingStep && !watchingDisabled) {
      updateBars();
    }
  },
  { deep: true },
);

async function applyStep(step: { type: string; indices: number[]; arraySnapshot?: number[] }): Promise<number | undefined> {
  // 对于所有步骤类型，都设置标志防止 watcher 干扰
  isApplyingStep = true;

  let delay: number | undefined;

  if (step.type === "swap" || step.type === "merge") {
    // 保存旧位置必须在 updateBars 之前，否则柱子已经跳到新位置了
    const oldPositions = new Map<number, number>();
    step.indices.forEach((idx) => {
      const bar = barStates.value.find((b) => b.index === idx);
      if (bar) oldPositions.set(bar.value, bar.x);
    });
    // 先排队动画（此时柱子还在旧位置）
    // 等待动画完成后再更新数组
    delay = await onStep(step as any, props.animationSpeed, oldPositions);
    // 动画完成后才更新显示数组
    if (step.arraySnapshot) {
      displayArray.value = [...step.arraySnapshot];
    }
  } else if (step.type === "compare" || step.type === "set") {
    // compare 和 set 操作需要等待一个间隔再执行下一步
    delay = props.animationSpeed;
  }

  // 重置标志
  isApplyingStep = false;

  return delay;
}

function setWatchingDisabled(val: boolean) {
  watchingDisabled = val;
}

defineExpose({ applyStep, updateBars, setWatchingDisabled });
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
