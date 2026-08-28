<script setup lang="ts">
import { ref, computed, toRef, watch, type Component } from "vue";
import { useSortStore } from "@/stores/sortStore";
import { useSortAnimation, type ISortCanvas } from "@/composables/useSortAnimation";
import { algorithmInfo } from "@/types/sorting";
import type { SortAlgorithm } from "@/types/sorting";
import { COMPARE_ALGORITHMS } from "@/composables/useCompareUtils";

import {
  bubbleSort,
  insertionSort,
  mergeSort,
  quickSort,
  shellSort,
  bucketSort,
  heapSort,
} from "@/utils/sortingAlgorithms";

import SortBarCanvas from "@/components/SortBarCanvas.vue";
import SortBarCanvasMerge from "@/components/SortBarCanvasMerge.vue";
import SortBarCanvasBucket from "@/components/SortBarCanvasBucket.vue";
import SortBarCanvasHeap from "@/components/SortBarCanvasHeap.vue";

const props = defineProps<{
  algorithm: SortAlgorithm;
  speed: number;
  disabledAlgorithm?: SortAlgorithm;
}>();

const emit = defineEmits<{
  (e: "update:algorithm", value: SortAlgorithm): void;
  (e: "update:playing", value: boolean): void;
  (e: "update:stats", value: { algorithm: SortAlgorithm; comparisons: number; swaps: number; currentStep: number; totalSteps: number }): void;
}>();

const store = useSortStore();

/* ── 内部状态 ── */
const canvasRef = ref<ISortCanvas | null>(null);
const canvasWidthRef = ref(360);
const canvasHeightRef = ref(460);
const heapMode = ref<"max" | "min">("max");

/* ── 排序函数映射 ── */
const sortFnMap: Record<SortAlgorithm, (arr: number[]) => ReturnType<typeof bubbleSort>> = {
  bubble: bubbleSort,
  insertion: insertionSort,
  merge: mergeSort,
  quick: quickSort,
  shell: shellSort,
  bucket: bucketSort,
  heap: (arr) => heapSort(arr, heapMode.value),
};

/* ── Canvas 组件映射 ── */
const canvasComponentMap: Record<SortAlgorithm, Component> = {
  bubble: SortBarCanvas,
  insertion: SortBarCanvas,
  merge: SortBarCanvasMerge,
  quick: SortBarCanvas,
  shell: SortBarCanvas,
  bucket: SortBarCanvasBucket,
  heap: SortBarCanvasHeap,
};

const currentCanvasComponent = computed(() => canvasComponentMap[props.algorithm]);

/* ── canvas-ready 事件归一化 ── */
function handleCanvasReady(payload: number | { width: number; height: number }) {
  if (typeof payload === "number") {
    canvasWidthRef.value = payload;
  } else {
    canvasWidthRef.value = payload.width;
    canvasHeightRef.value = payload.height;
  }
}

/* ── 核心编排器 ── */
const {
  array,
  currentStep,
  totalSteps,
  isPlaying,
  isReady,
  isAtEnd,
  play,
  pause,
  step: stepOnce,
  stepBack,
  reset,
  rebuild,
  comparisons,
  swaps,
  statusText,
  statusClass,
  progressPct,
  handleSeek,
} = useSortAnimation({
  sortFn: sortFnMap[props.algorithm],
  speed: toRef(props, "speed"),
  canvasRef,
  canvasWidth: canvasWidthRef,
  canvasHeight: canvasHeightRef,
  originalArray: toRef(store, "originalArray"),
  algorithm: props.algorithm,
  heapMode,
});

/* ── 堆模式切换时重建 ── */
watch(heapMode, () => {
  if (isPlaying.value) pause();
  rebuild();
});

/* ── 堆模式切换 ── */
function toggleHeapMode() {
  heapMode.value = heapMode.value === "max" ? "min" : "max";
}

/* ── 播放状态变化通知父组件 ── */
watch(isPlaying, (val) => emit("update:playing", val), { immediate: true });

watch(
  [comparisons, swaps, currentStep, totalSteps],
  () => {
    emit("update:stats", {
      algorithm: props.algorithm,
      comparisons: comparisons.value,
      swaps: swaps.value,
      currentStep: currentStep.value,
      totalSteps: totalSteps.value,
    });
  },
  { immediate: true },
);

/* ── 算法切换处理（实际重建由父组件 :key 控制） ── */
function handleAlgorithmChange(e: Event) {
  const value = (e.target as HTMLSelectElement).value as SortAlgorithm;
  emit("update:algorithm", value);
}

/* ── 暴露给父组件的接口 ── */
defineExpose({
  play,
  pause,
  step: stepOnce,
  stepBack,
  reset,
  isPlaying,
  isReady,
  isAtEnd,
  comparisons,
  swaps,
  currentStep,
  totalSteps,
  progressPct,
  handleSeek,
});
</script>

<template>
  <div class="compare-slot">
    <!-- 头部 -->
    <div class="slot-header">
      <select
        :value="algorithm"
        @change="handleAlgorithmChange"
        class="slot-algo-select"
      >
        <option
          v-for="alg in COMPARE_ALGORITHMS"
          :key="alg"
          :value="alg"
          :disabled="alg === props.disabledAlgorithm"
        >
          {{ algorithmInfo[alg].name }}{{ alg === props.disabledAlgorithm ? ' (另一侧)' : '' }}
        </option>
      </select>
      <button
        v-if="algorithm === 'heap'"
        class="heap-mode-btn"
        :class="heapMode"
        @click="toggleHeapMode"
        :title="heapMode === 'max' ? '最大堆（升序），点击切换为最小堆' : '最小堆（降序），点击切换为最大堆'"
      >
        {{ heapMode === 'max' ? '最大堆' : '最小堆' }}
      </button>
      <span class="slot-complexity">{{ algorithmInfo[algorithm].complexity }}</span>
      <div class="slot-stats">
        <span class="stat-item">比较 <strong>{{ comparisons }}</strong></span>
        <span class="stat-divider">·</span>
        <span class="stat-item">交换 <strong>{{ swaps }}</strong></span>
        <span class="stat-divider">·</span>
        <span class="stat-item">{{ currentStep }}/{{ totalSteps }}</span>
      </div>
      <div class="slot-status" :class="statusClass">
        <span class="dot"></span>
        <span class="status-text">{{ statusText }}</span>
      </div>
    </div>

    <!-- Canvas 区域 -->
    <div class="slot-canvas-wrap">
      <component
        :is="currentCanvasComponent"
        ref="canvasRef"
        :array="array"
        :animation-speed="speed"
        @canvas-ready="handleCanvasReady"
      />
    </div>

    <!-- 底部进度条 -->
    <div class="slot-progress">
      <div class="slot-track-wrap" @click="handleSeek">
        <div class="slot-track">
          <div class="slot-fill" :style="{ width: progressPct + '%' }"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
/* ── 槽位容器 ── */
.compare-slot {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  box-shadow: var(--panel-shadow);
}

/* ── 头部区域 ── */
.slot-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-2);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

/* ── 算法选择下拉框 ── */
.slot-algo-select {
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 4px 24px 4px 8px;
  border: 1px solid var(--border);
  background: var(--bg-3);
  color: var(--text);
  border-radius: 4px;
  cursor: pointer;
  outline: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%238b95a8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 6px center;
  min-width: 72px;
  transition: border-color 0.2s ease;
}

.slot-algo-select:hover,
.slot-algo-select:focus {
  border-color: var(--accent);
}

.slot-algo-select option {
  background: var(--bg-3);
  color: var(--text);
}

/* ── 复杂度标签 ── */
.slot-complexity {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-secondary);
  padding: 1px 6px;
  background: transparent;
  border-radius: 3px;
  border: 1px solid var(--border);
  white-space: nowrap;
  font-weight: 600;
}

/* ── 堆模式切换按钮：max 走 swapping 系、min 走 accent 系 ── */
.heap-mode-btn {
  font-family: var(--font-mono);
  font-size: 10px;
  padding: 1px 6px;
  border: 1px solid var(--border);
  background: var(--bg-3);
  color: var(--text-secondary);
  border-radius: 3px;
  cursor: pointer;
  transition: border-color 0.2s ease, color 0.2s ease;
  white-space: nowrap;
  font-weight: 600;
}

.heap-mode-btn:hover {
  border-color: var(--accent);
}

.heap-mode-btn.max {
  color: var(--swapping);
  border-color: var(--swapping);
}

.heap-mode-btn.min {
  color: var(--accent);
  border-color: var(--accent);
}

/* ── 统计信息 ── */
.slot-stats {
  display: flex;
  align-items: center;
  gap: 4px;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-muted);
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.stat-item strong {
  color: var(--text-secondary);
  font-weight: 600;
}

.stat-divider {
  color: var(--text-muted);
  margin: 0 1px;
}

/* ── 状态指示 ── */
.slot-status {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.slot-status .dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  flex-shrink: 0;
  transition: background 0.2s ease;
}

.slot-status.ready .dot { background: var(--text-muted); }
.slot-status.playing .dot {
  background: var(--accent);
  animation: status-pulse 1s ease-in-out infinite;
}
.slot-status.paused .dot { background: var(--swapping); }
.slot-status.done .dot { background: var(--sorted); }
.slot-status.loading .dot { background: var(--accent); }

@keyframes status-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(0.8); }
}

.slot-status .status-text {
  font-family: var(--font-mono);
  font-size: 10px;
  white-space: nowrap;
}

.slot-status.ready .status-text { color: var(--text-muted); }
.slot-status.playing .status-text { color: var(--accent); }
.slot-status.paused .status-text { color: var(--swapping); }
.slot-status.done .status-text { color: var(--sorted); }
.slot-status.loading .status-text { color: var(--accent); }

/* ── Canvas 区域 ── */
.slot-canvas-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  overflow: hidden;
}

/* ── 底部进度条 ── */
.slot-progress {
  flex-shrink: 0;
  padding: 6px 12px 8px;
}

.slot-track-wrap {
  width: 100%;
  height: 3px;
  background: var(--bg-3);
  border: 1px solid var(--border);
  border-radius: 2px;
  overflow: hidden;
  cursor: pointer;
  transition: height 0.15s ease;

  &:hover {
    height: 5px;
  }
}

.slot-track {
  width: 100%;
  height: 100%;
  position: relative;
}

.slot-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
  transition: width 0.05s linear;
}
</style>
