# 算法对比模式 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为排序可视化工具添加算法对比模式，允许用户同时运行两种排序算法，以时间同步方式播放，直观对比性能差异。

**Architecture:** 在现有单算法模式之上新增对比模式。通过 `sortStore` 新增 `viewMode` 状态控制模式切换；新增 `CompareSlot` 组件封装单个算法的可视化（Canvas + useSortAnimation + 统计），通过 `:key` 强制重建实现算法热切换；新增 `CompareView` 组件编排两个 Slot 实例并提供共享播放控制。不修改现有算法页面组件。

**Tech Stack:** Vue 3 Composition API, TypeScript, Pinia, Canvas 2D（均复用现有）

---

## 文件结构

### 新增文件
| 文件 | 职责 |
|------|------|
| `src/composables/useCompareUtils.ts` | 对比模式工具函数（数组大小上限、默认右侧算法） |
| `src/components/CompareSlot.vue` | 单侧算法槽位（算法选择器 + Canvas + 统计） |
| `src/components/CompareView.vue` | 对比模式主容器（布局切换 + 共享控制 + 两个 Slot） |

### 修改文件
| 文件 | 变更内容 |
|------|---------|
| `src/stores/sortStore.ts` | 新增 viewMode / compareLayout / leftAlgorithm / rightAlgorithm / savedAlgorithm / savedArraySize 状态及 enterCompareMode / exitCompareMode 等方法 |
| `src/components/SortVisualizer.vue` | 根据 viewMode 切换单算法视图或 CompareView |
| `src/components/ControlPanel.vue` | 新增"对比模式"入口按钮；对比模式下隐藏算法下拉 |

---

## Task 1: 扩展 sortStore —— 对比模式状态

**Files:**
- Modify: `src/stores/sortStore.ts`

- [ ] **Step 1: 新增对比模式相关状态和方法**

在 `sortStore.ts` 中新增以下内容。在现有 `algorithm` ref 之后添加对比模式状态，在 `return` 中导出所有新增成员。

```typescript
// src/stores/sortStore.ts —— 在 import 之后、defineStore 内部添加

import { defineStore } from "pinia";
import { ref } from "vue";
import type { SortAlgorithm } from "@/types/sorting";

export interface ArrayElement {
  value: number;
  displayIndex: number;
}

export type ViewMode = 'single' | 'compare';
export type CompareLayout = 'horizontal' | 'vertical';

export const useSortStore = defineStore("sort", () => {
  // ── 现有状态（不变） ──
  const originalArray = ref<ArrayElement[]>([]);
  const animationSpeed = ref(200);
  const arraySize = ref(10);
  const algorithm = ref<SortAlgorithm>("heap");

  // ── 对比模式状态 ──
  const viewMode = ref<ViewMode>('single');
  const compareLayout = ref<CompareLayout>('horizontal');
  const leftAlgorithm = ref<SortAlgorithm>('bubble');
  const rightAlgorithm = ref<SortAlgorithm>('quick');
  const savedAlgorithm = ref<SortAlgorithm | null>(null);
  const savedArraySize = ref<number | null>(null);

  // ── 现有方法（不变） ──
  function generateArray(size: number) {
    const values = Array.from({ length: size }, (_, i) => i + 1);
    for (let i = values.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }
    const arr: ArrayElement[] = values.map((value, index) => ({ value, displayIndex: index + 1 }));
    originalArray.value = arr;
  }

  function setSpeed(speed: number) { animationSpeed.value = speed; }
  function setAlgorithm(alg: SortAlgorithm) { algorithm.value = alg; }

  // ── 对比模式方法 ──
  function setViewMode(mode: ViewMode) { viewMode.value = mode; }
  function setCompareLayout(layout: CompareLayout) { compareLayout.value = layout; }
  function setLeftAlgorithm(alg: SortAlgorithm) { leftAlgorithm.value = alg; }
  function setRightAlgorithm(alg: SortAlgorithm) { rightAlgorithm.value = alg; }

  function enterCompareMode() {
    savedAlgorithm.value = algorithm.value;
    savedArraySize.value = arraySize.value;
    leftAlgorithm.value = algorithm.value;
    // 默认右侧选一个不同的算法
    const all: SortAlgorithm[] = ['bubble', 'insertion', 'merge', 'quick', 'shell', 'bucket', 'heap'];
    const idx = all.indexOf(algorithm.value);
    rightAlgorithm.value = all[(idx + 1) % all.length];
    viewMode.value = 'compare';
  }

  function exitCompareMode() {
    viewMode.value = 'single';
    if (savedAlgorithm.value !== null) {
      algorithm.value = savedAlgorithm.value;
      savedAlgorithm.value = null;
    }
    if (savedArraySize.value !== null && savedArraySize.value !== arraySize.value) {
      arraySize.value = savedArraySize.value;
      generateArray(savedArraySize.value);
      savedArraySize.value = null;
    }
  }

  return {
    // 现有
    originalArray, animationSpeed, arraySize, algorithm,
    generateArray, setSpeed, setAlgorithm,
    // 对比模式
    viewMode, compareLayout, leftAlgorithm, rightAlgorithm,
    savedAlgorithm, savedArraySize,
    setViewMode, setCompareLayout, setLeftAlgorithm, setRightAlgorithm,
    enterCompareMode, exitCompareMode,
  };
});
```

- [ ] **Step 2: 用 Grep 确认修改不影响现有引用**

运行: `rg "useSortStore" src/ --type vue --type ts -l`
预期: 所有现有文件仍正常引用，无破坏性变更。

---

## Task 2: 创建对比模式工具函数

**Files:**
- Create: `src/composables/useCompareUtils.ts`

- [ ] **Step 1: 编写 useCompareUtils.ts**

```typescript
// src/composables/useCompareUtils.ts
import type { SortAlgorithm } from "@/types/sorting";

type AlgorithmCategory = 'simple' | 'medium' | 'complex';

const ALGORITHM_CATEGORIES: Record<SortAlgorithm, AlgorithmCategory> = {
  bubble: 'simple',
  insertion: 'simple',
  quick: 'simple',
  shell: 'simple',
  merge: 'medium',
  bucket: 'complex',
  heap: 'complex',
};

/** 根据两侧算法组合返回元素数量上限 */
export function getCompareMaxArraySize(algA: SortAlgorithm, algB: SortAlgorithm): number {
  const catA = ALGORITHM_CATEGORIES[algA];
  const catB = ALGORITHM_CATEGORIES[algB];

  // 双方都是复杂算法（桶/堆）
  if (catA === 'complex' && catB === 'complex') return 25;
  // 任一方是复杂算法
  if (catA === 'complex' || catB === 'complex') return 40;
  // 任一方是中等算法（归并）
  if (catA === 'medium' || catB === 'medium') return 60;
  // 双方都是简单算法
  return 100;
}

/** 获取所有可选算法列表 */
export const COMPARE_ALGORITHMS: SortAlgorithm[] = [
  'bubble', 'insertion', 'quick', 'shell', 'merge', 'bucket', 'heap',
];
```

---

## Task 3: 创建 CompareSlot 组件

**Files:**
- Create: `src/components/CompareSlot.vue`

CompareSlot 是单个算法的可视化槽位。内部包含：算法选择下拉、Canvas 组件、统计信息。通过 `:key` 在算法切换时整体重建。对外暴露 play/pause/step/stepBack/reset 等方法。

- [ ] **Step 1: 编写 CompareSlot.vue**

```vue
<!-- src/components/CompareSlot.vue -->
<script setup lang="ts">
import { ref, computed, toRef, watch, type Component } from "vue";
import { useSortStore } from "@/stores/sortStore";
import { useSortAnimation, type ISortCanvas } from "@/composables/useSortAnimation";
import { algorithmInfo } from "@/types/sorting";
import type { SortAlgorithm } from "@/types/sorting";
import type { SemanticStep } from "@/types/timeline";
import { COMPARE_ALGORITHMS } from "@/composables/useCompareUtils";

import { bubbleSort, insertionSort, mergeSort, quickSort, shellSort, bucketSort, heapSort } from "@/utils/sortingAlgorithms";

import SortBarCanvas from "@/components/SortBarCanvas.vue";
import SortBarCanvasMerge from "@/components/SortBarCanvasMerge.vue";
import SortBarCanvasBucket from "@/components/SortBarCanvasBucket.vue";
import SortBarCanvasHeap from "@/components/SortBarCanvasHeap.vue";

const props = defineProps<{
  algorithm: SortAlgorithm;
  speed: number;
}>();

const emit = defineEmits<{
  (e: "update:algorithm", value: SortAlgorithm): void;
}>();

const store = useSortStore();
const canvasRef = ref<ISortCanvas | null>(null);
const canvasWidthRef = ref(360);
const canvasHeightRef = ref(460);

const heapMode = ref<"max" | "min">("max");

// ── 排序函数映射 ──
const sortFnMap: Record<SortAlgorithm, (arr: number[]) => SemanticStep[]> = {
  bubble: bubbleSort,
  insertion: insertionSort,
  merge: mergeSort,
  quick: quickSort,
  shell: shellSort,
  bucket: bucketSort,
  heap: (arr) => heapSort(arr, heapMode.value),
};

// ── Canvas 组件映射 ──
const canvasComponentMap: Record<SortAlgorithm, Component> = {
  bubble: SortBarCanvas,
  insertion: SortBarCanvas,
  quick: SortBarCanvas,
  shell: SortBarCanvas,
  merge: SortBarCanvasMerge,
  bucket: SortBarCanvasBucket,
  heap: SortBarCanvasHeap,
};

const currentCanvasComponent = computed(() => canvasComponentMap[props.algorithm]);

// ── Canvas ready 事件归一化 ──
function handleCanvasReady(payload: number | { width: number; height: number }) {
  if (typeof payload === "number") {
    canvasWidthRef.value = payload;
  } else {
    canvasWidthRef.value = payload.width;
    canvasHeightRef.value = payload.height;
  }
}

// ── 核心动画引擎 ──
const {
  array, steps, currentStep, totalSteps,
  isPlaying, isReady, isAtEnd,
  play, pause, step: stepOnce, stepBack, reset, rebuild,
  comparisons, swaps,
  statusText, statusClass, progressPct,
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

// ── 算法切换 ──
function handleAlgorithmChange(e: Event) {
  const value = (e.target as HTMLSelectElement).value as SortAlgorithm;
  emit("update:algorithm", value);
}

// ── 堆模式切换（仅堆排序可见） ──
watch(heapMode, () => {
  if (isPlaying.value) pause();
  rebuild();
});

// ── 对外暴露 ──
defineExpose({
  play, pause,
  step: stepOnce, stepBack, reset,
  isPlaying, isReady, isAtEnd,
  comparisons, swaps,
  currentStep, totalSteps, progressPct,
});
</script>

<template>
  <div class="compare-slot">
    <!-- 头部：算法选择 + 统计 -->
    <div class="slot-header">
      <select :value="algorithm" @change="handleAlgorithmChange" class="slot-algo-select">
        <option v-for="alg in COMPARE_ALGORITHMS" :key="alg" :value="alg">
          {{ algorithmInfo[alg].name }}
        </option>
      </select>
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

    <!-- Canvas -->
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
      <div class="slot-track-wrap">
        <div class="slot-track">
          <div class="slot-fill" :style="{ width: progressPct + '%' }"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.compare-slot {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: rgba(10, 10, 20, 0.5);
  border: 1px solid rgba(74, 158, 255, 0.12);
  border-radius: 10px;
  overflow: hidden;
}

.slot-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(10, 10, 20, 0.6);
  border-bottom: 1px solid rgba(74, 158, 255, 0.08);
  flex-shrink: 0;
}

.slot-algo-select {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  padding: 4px 24px 4px 8px;
  border: 1px solid rgba(74, 158, 255, 0.25);
  background: rgba(74, 158, 255, 0.08);
  color: #6bb3ff;
  border-radius: 4px;
  cursor: pointer;
  outline: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%238b95a8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 6px center;
  min-width: 72px;
  transition: all 0.2s ease;
}

.slot-algo-select:hover {
  background-color: rgba(74, 158, 255, 0.12);
  border-color: rgba(74, 158, 255, 0.4);
}

.slot-algo-select option {
  background: #0d1117;
  color: #e0e0e0;
}

.slot-complexity {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: #4adeee;
  padding: 2px 6px;
  background: rgba(74, 222, 222, 0.08);
  border: 1px solid rgba(74, 222, 222, 0.18);
  border-radius: 3px;
  white-space: nowrap;
}

.slot-stats {
  display: flex;
  align-items: center;
  gap: 4px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: #a8b2c8;
  margin-left: auto;
}

.slot-stats strong {
  color: #5dddd4;
  font-weight: 600;
}

.stat-divider {
  color: rgba(74, 158, 255, 0.25);
}

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

.slot-status.ready .dot { background: #8b95a8; }
.slot-status.playing .dot {
  background: #5dddd4;
  box-shadow: 0 0 6px rgba(93, 221, 212, 0.5);
  animation: slot-pulse 1s ease-in-out infinite;
}
.slot-status.paused .dot { background: #ff8a8a; }
.slot-status.done .dot { background: #6bff6b; }

@keyframes slot-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(0.85); }
}

.slot-status .status-text {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  white-space: nowrap;
}

.slot-status.ready .status-text { color: #8b95a8; }
.slot-status.playing .status-text { color: #5dddd4; }
.slot-status.paused .status-text { color: #ff8a8a; }
.slot-status.done .status-text { color: #6bff6b; }

.slot-canvas-wrap {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* 让内部 Canvas 组件的 corner brackets 和容器适配 */
.slot-canvas-wrap :deep(.sort-bar-canvas) {
  min-height: 200px !important;
  padding: 10px 12px;
}

.slot-progress {
  padding: 6px 12px 8px;
  flex-shrink: 0;
}

.slot-track-wrap {
  width: 100%;
  height: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
}

.slot-track {
  width: 100%;
  height: 3px;
  background: rgba(74, 158, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.slot-fill {
  height: 100%;
  background: linear-gradient(90deg, #4a9eff, #4ecdc4);
  border-radius: 2px;
  transition: width 0.05s linear;
}
</style>
```

- [ ] **Step 2: 用 Grep 确认所有 import 路径正确**

运行: `rg "from.*useCompareUtils" src/ -l`
运行: `rg "from.*sortingAlgorithms" src/ -l`
预期: CompareSlot.vue 出现在结果中。

---

## Task 4: 创建 CompareView 组件

**Files:**
- Create: `src/components/CompareView.vue`

CompareView 编排两个 CompareSlot，提供共享播放控制和布局切换。播放/暂停/步进/重置同时作用于两侧。

- [ ] **Step 1: 编写 CompareView.vue**

```vue
<!-- src/components/CompareView.vue -->
<script setup lang="ts">
import { ref, computed } from "vue";
import { useSortStore } from "@/stores/sortStore";
import { getCompareMaxArraySize } from "@/composables/useCompareUtils";
import type { SortAlgorithm } from "@/types/sorting";
import CompareSlot from "@/components/CompareSlot.vue";

const store = useSortStore();

const leftSlot = ref<InstanceType<typeof CompareSlot> | null>(null);
const rightSlot = ref<InstanceType<typeof CompareSlot> | null>(null);

// ── 布局切换 ──
const isHorizontal = computed(() => store.compareLayout === 'horizontal');

function toggleLayout() {
  store.setCompareLayout(isHorizontal.value ? 'vertical' : 'horizontal');
}

// ── 共享播放控制 ──
function syncPlay() {
  leftSlot.value?.play();
  rightSlot.value?.play();
}

function syncPause() {
  leftSlot.value?.pause();
  rightSlot.value?.pause();
}

function syncStep() {
  leftSlot.value?.step();
  rightSlot.value?.step();
}

function syncStepBack() {
  leftSlot.value?.stepBack();
  rightSlot.value?.stepBack();
}

function syncReset() {
  leftSlot.value?.reset();
  rightSlot.value?.reset();
}

// 任一侧正在播放则视为整体播放中
const isAnyPlaying = computed(() =>
  (leftSlot.value?.isPlaying?.value ?? false) ||
  (rightSlot.value?.isPlaying?.value ?? false)
);

// ── 算法切换 + 动态大小限制 ──
function handleLeftAlgorithmChange(alg: SortAlgorithm) {
  enforceSizeLimit(alg, store.rightAlgorithm);
  store.setLeftAlgorithm(alg);
}

function handleRightAlgorithmChange(alg: SortAlgorithm) {
  enforceSizeLimit(store.leftAlgorithm, alg);
  store.setRightAlgorithm(alg);
}

function enforceSizeLimit(algA: SortAlgorithm, algB: SortAlgorithm) {
  const max = getCompareMaxArraySize(algA, algB);
  if (store.arraySize > max) {
    store.arraySize = max;
    store.generateArray(max);
  }
}

// ── 退出对比模式 ──
function exitCompare() {
  store.exitCompareMode();
}
</script>

<template>
  <div class="compare-view">
    <!-- 两个算法槽位 -->
    <div class="compare-slots" :class="store.compareLayout">
      <CompareSlot
        ref="leftSlot"
        :key="store.leftAlgorithm"
        :algorithm="store.leftAlgorithm"
        :speed="store.animationSpeed"
        @update:algorithm="handleLeftAlgorithmChange"
      />
      <CompareSlot
        ref="rightSlot"
        :key="store.rightAlgorithm"
        :algorithm="store.rightAlgorithm"
        :speed="store.animationSpeed"
        @update:algorithm="handleRightAlgorithmChange"
      />
    </div>

    <!-- 共享控制栏 -->
    <div class="compare-controls">
      <button class="cc-btn layout-btn" @click="toggleLayout" :title="isHorizontal ? '切换为上下布局' : '切换为左右布局'">
        <svg v-if="isHorizontal" class="cc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="7" height="18" rx="2" />
          <rect x="14" y="3" width="7" height="18" rx="2" />
        </svg>
        <svg v-else class="cc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="7" rx="2" />
          <rect x="3" y="14" width="18" height="7" rx="2" />
        </svg>
      </button>

      <div class="cc-divider"></div>

      <button class="cc-btn" @click="syncStepBack" title="两侧单步后退">
        <svg class="cc-icon" viewBox="0 0 24 24" fill="currentColor"><polygon points="19,4 9,12 19,20"/><rect x="5" y="4" width="3" height="16"/></svg>
      </button>
      <button class="cc-btn" :class="{ active: isAnyPlaying }" @click="isAnyPlaying ? syncPause() : syncPlay()" title="播放/暂停 (两侧同步)">
        <svg v-if="!isAnyPlaying" class="cc-icon" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
        <svg v-else class="cc-icon" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
      </button>
      <button class="cc-btn" @click="syncStep" title="两侧单步前进">
        <svg class="cc-icon" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,4 15,12 5,20"/><rect x="16" y="4" width="3" height="16"/></svg>
      </button>
      <button class="cc-btn" @click="syncReset" title="两侧重置">
        <svg class="cc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
      </button>

      <div class="cc-divider"></div>

      <button class="cc-btn exit-btn" @click="exitCompare" title="退出对比模式">
        <svg class="cc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
        <span class="exit-text">退出对比</span>
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.compare-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 12px;
}

.compare-slots {
  display: flex;
  flex: 1;
  min-height: 0;
  gap: 12px;
}

.compare-slots.horizontal {
  flex-direction: row;
  & > * { flex: 1; min-width: 0; }
}

.compare-slots.vertical {
  flex-direction: column;
  & > * { flex: 1; min-height: 0; }
}

/* 共享控制栏 */
.compare-controls {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 16px;
  background: rgba(10, 10, 20, 0.7);
  border: 1px solid rgba(74, 158, 255, 0.12);
  border-radius: 10px;
  backdrop-filter: blur(12px);
  flex-shrink: 0;
}

.cc-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 30px;
  padding: 0 10px;
  border: 1px solid rgba(74, 158, 255, 0.2);
  background: rgba(74, 158, 255, 0.05);
  color: #8b95a8;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.cc-btn:hover:not(:disabled) {
  background: rgba(74, 158, 255, 0.12);
  border-color: rgba(74, 158, 255, 0.35);
  color: #c0c8d8;
}

.cc-btn.active {
  color: #ff8a8a;
  border-color: rgba(255, 138, 138, 0.3);
  background: rgba(255, 138, 138, 0.07);
}

.cc-icon {
  width: 13px;
  height: 13px;
}

.cc-divider {
  width: 1px;
  height: 24px;
  background: linear-gradient(180deg, transparent, rgba(74, 158, 255, 0.25) 30%, rgba(74, 158, 255, 0.25) 70%, transparent);
  margin: 0 8px;
}

.layout-btn {
  color: #4ecdc4;
  border-color: rgba(78, 205, 196, 0.25);
}

.layout-btn:hover {
  background: rgba(78, 205, 196, 0.12);
  border-color: rgba(78, 205, 196, 0.4);
}

.exit-btn {
  margin-left: auto;
  color: #ff8a8a;
  border-color: rgba(255, 138, 138, 0.2);
}

.exit-btn:hover {
  background: rgba(255, 138, 138, 0.1);
  border-color: rgba(255, 138, 138, 0.4);
}

.exit-text {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
}

@media (max-width: 900px) {
  .compare-slots.horizontal {
    flex-direction: column;
    & > * { flex: 1; min-height: 0; }
  }
}
</style>
```

---

## Task 5: 修改 SortVisualizer —— 模式切换

**Files:**
- Modify: `src/components/SortVisualizer.vue`

- [ ] **Step 1: 在 SortVisualizer 中引入 CompareView，根据 viewMode 切换**

将 SortVisualizer.vue 改为：

```vue
<!-- src/components/SortVisualizer.vue -->
<script setup lang="ts">
import { ref, computed } from "vue";
import { useSortStore } from "@/stores/sortStore";
import {
  BubbleSort,
  BucketSort,
  HeapSort,
  InsertionSort,
  MergeSort,
  QuickSort,
  ShellSort,
} from "@/components/algorithms";
import CompareView from "@/components/CompareView.vue";

interface SortAlgorithmExposed {
  reset(): void;
  step(): void;
}

const store = useSortStore();
const algorithmRef = ref<SortAlgorithmExposed | null>(null);

const componentMap = {
  bubble: BubbleSort,
  bucket: BucketSort,
  heap: HeapSort,
  insertion: InsertionSort,
  merge: MergeSort,
  quick: QuickSort,
  shell: ShellSort,
} as const;

const currentComponent = computed(
  () => componentMap[store.algorithm] ?? MergeSort,
);

const isCompareMode = computed(() => store.viewMode === 'compare');

function reset() {
  algorithmRef.value?.reset();
}

function step() {
  algorithmRef.value?.step();
}

defineExpose({ reset, step });
</script>

<template>
  <div class="visualizer" ref="containerRef">
    <!-- 单算法模式 -->
    <component
      v-if="!isCompareMode"
      :is="currentComponent"
      ref="algorithmRef"
      :speed="store.animationSpeed"
    />
    <!-- 对比模式 -->
    <CompareView v-else />
  </div>
</template>

<style lang="scss" scoped>
.visualizer {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 400px;
  position: relative;
}
</style>
```

---

## Task 6: 修改 ControlPanel —— 对比模式入口

**Files:**
- Modify: `src/components/ControlPanel.vue`

- [ ] **Step 1: 在 ControlPanel 中添加对比模式入口按钮，并在对比模式下隐藏算法下拉框**

在 `<script setup>` 中新增对比模式相关逻辑，并在模板中添加按钮和条件渲染。

script setup 部分，在现有代码末尾添加：

```typescript
// ── 对比模式 ──
const isCompareMode = computed(() => store.viewMode === 'compare');

function enterCompare() {
  store.enterCompareMode();
}

function exitCompare() {
  store.exitCompareMode();
}
```

需要在 import 行添加 `computed`：
```typescript
import { ref, watch, computed } from 'vue';
```

模板部分，在算法选择 `<select>` 外层添加 `v-if="!isCompareMode"`，在操作按钮区域末尾添加对比模式切换按钮：

```html
<template>
  <div class="control-panel">
    <!-- 算法选择：对比模式下隐藏 -->
    <div v-if="!isCompareMode" class="panel-section algo-section">
      <select :value="store.algorithm" @change="e => handleAlgorithmChange((e.target as HTMLSelectElement).value as SortAlgorithm)" class="algo-dropdown">
        <option v-for="alg in algorithms" :key="alg.value" :value="alg.value">{{ alg.label }}</option>
      </select>
    </div>

    <!-- 算法信息：单算法模式显示 -->
    <div v-if="!isCompareMode" class="panel-section algo-info-section">
      <div class="algo-info">
        <span class="algo-complexity">{{ algorithmInfo[store.algorithm].complexity }}</span>
        <span class="algo-desc">{{ algorithmInfo[store.algorithm].description }}</span>
      </div>
    </div>

    <!-- 对比模式标签 -->
    <div v-if="isCompareMode" class="panel-section compare-badge-section">
      <span class="compare-badge">对比模式</span>
    </div>

    <div class="panel-divider"></div>

    <div class="panel-section size-section">
      <div class="size-control">
        <input type="range" :value="store.arraySize" @input="e => handleSizeChange(Number((e.target as HTMLInputElement).value))" min="10" :max="isCompareMode ? compareMaxSize : 100" step="1" class="size-slider" />
        <span class="size-value">{{ store.arraySize }}</span>
      </div>
    </div>

    <div class="panel-divider"></div>

    <div class="panel-section speed-section">
      <div class="speed-control">
        <input type="range" v-model="sliderValue" min="20" max="500" step="10" class="speed-slider" />
        <span class="speed-value">{{ sliderValue }}ms</span>
      </div>
      <div class="speed-marks">
        <span>快</span>
        <span>中</span>
        <span>慢</span>
      </div>
    </div>

    <div class="panel-divider"></div>

    <div class="panel-section action-section">
      <button class="action-btn" @click="handleNewArray">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M23 4v6h-6M1 20v-6h6" />
          <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
        </svg>
        新数组
      </button>
    </div>

    <div class="panel-divider"></div>

    <div class="panel-section action-section">
      <button v-if="!isCompareMode" class="action-btn compare-enter-btn" @click="enterCompare">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="7" height="18" rx="2" />
          <rect x="14" y="3" width="7" height="18" rx="2" />
        </svg>
        对比模式
      </button>
      <button v-else class="action-btn compare-exit-btn" @click="exitCompare">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
        退出对比
      </button>
    </div>
  </div>
</template>
```

在 script setup 中新增 `compareMaxSize` 计算属性：

```typescript
import { getCompareMaxArraySize } from '@/composables/useCompareUtils';

const compareMaxSize = computed(() =>
  getCompareMaxArraySize(store.leftAlgorithm, store.rightAlgorithm)
);
```

在 `<style>` 中新增对比模式相关样式：

```scss
/* 对比模式标签 */
.compare-badge {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: #4ecdc4;
  padding: 4px 12px;
  background: rgba(78, 205, 196, 0.1);
  border: 1px solid rgba(78, 205, 196, 0.25);
  border-radius: 5px;
  white-space: nowrap;
}

.compare-enter-btn {
  color: #4ecdc4;
  border-color: rgba(78, 205, 196, 0.3);
  background: rgba(78, 205, 196, 0.08);
}

.compare-enter-btn:hover {
  background: rgba(78, 205, 196, 0.15);
  border-color: rgba(78, 205, 196, 0.5);
  box-shadow: 0 0 16px rgba(78, 205, 196, 0.15);
}

.compare-exit-btn {
  color: #ff8a8a;
  border-color: rgba(255, 138, 138, 0.3);
  background: rgba(255, 138, 138, 0.08);
}

.compare-exit-btn:hover {
  background: rgba(255, 138, 138, 0.15);
  border-color: rgba(255, 138, 138, 0.5);
}
```

- [ ] **Step 2: 静态验证**

用 Grep 确认 ControlPanel 中的模板结构和 script setup 中引用的所有变量/方法都有定义：
- `isCompareMode` — computed，已定义
- `enterCompare` — function，已定义
- `exitCompare` — function，已定义
- `compareMaxSize` — computed，已定义
- `getCompareMaxArraySize` — import，已引入

---

## Task 7: 进入对比模式时的数组大小限制

**Files:**
- Modify: `src/stores/sortStore.ts`（已在 Task 1 修改）

- [ ] **Step 1: 在 enterCompareMode 中添加大小限制逻辑**

修改 Task 1 中 `enterCompareMode` 方法，添加对数组大小的检查和缩减。需要引入 `getCompareMaxArraySize`：

```typescript
// src/stores/sortStore.ts —— 在文件顶部添加 import
import { getCompareMaxArraySize } from "@/composables/useCompareUtils";

// 修改 enterCompareMode 方法：
function enterCompareMode() {
  savedAlgorithm.value = algorithm.value;
  savedArraySize.value = arraySize.value;
  leftAlgorithm.value = algorithm.value;

  const all: SortAlgorithm[] = ['bubble', 'insertion', 'merge', 'quick', 'shell', 'bucket', 'heap'];
  const idx = all.indexOf(algorithm.value);
  rightAlgorithm.value = all[(idx + 1) % all.length];

  // 检查数组大小是否超过新算法组合的上限
  const maxSize = getCompareMaxArraySize(leftAlgorithm.value, rightAlgorithm.value);
  if (arraySize.value > maxSize) {
    arraySize.value = maxSize;
    generateArray(maxSize);
  }

  viewMode.value = 'compare';
}
```

- [ ] **Step 2: 静态验证**

确认 `getCompareMaxArraySize` 的 import 路径正确：
运行: `rg "getCompareMaxArraySize" src/composables/useCompareUtils.ts`
预期: 找到函数定义。

---

## Task 8: 整体集成验证

- [ ] **Step 1: 检查所有新增文件的 import 关系是否正确**

验证以下 import 链：
1. `sortStore.ts` imports `getCompareMaxArraySize` from `useCompareUtils.ts` ✓
2. `CompareSlot.vue` imports `useSortAnimation` from existing ✓
3. `CompareSlot.vue` imports `COMPARE_ALGORITHMS` from `useCompareUtils.ts` ✓
4. `CompareSlot.vue` imports all sort functions from `sortingAlgorithms.ts` ✓
5. `CompareSlot.vue` imports all four Canvas components ✓
6. `CompareView.vue` imports `CompareSlot.vue` ✓
7. `CompareView.vue` imports `getCompareMaxArraySize` from `useCompareUtils.ts` ✓
8. `SortVisualizer.vue` imports `CompareView.vue` ✓
9. `ControlPanel.vue` imports `getCompareMaxArraySize` from `useCompareUtils.ts` ✓

- [ ] **Step 2: 检查类型一致性**

确认以下类型在各文件中一致使用：
- `SortAlgorithm`: 从 `@/types/sorting` 统一引入
- `ViewMode`, `CompareLayout`: 从 `@/stores/sortStore` 引入
- `ISortCanvas`: 从 `@/composables/useSortAnimation` 引入
- `SemanticStep`: 从 `@/types/timeline` 引入

- [ ] **Step 3: 检查 CompareSlot 的 :key 机制**

确认 CompareView 中两个 CompareSlot 都使用 `:key` 绑定到 store 中的算法值，确保算法切换时组件重建。

---

## 设计说明

### 进入对比模式流程

```
用户点击"对比模式"按钮
  → store.enterCompareMode()
  → 保存当前算法和数组大小
  → 设置左侧为当前算法，右侧为下一个算法
  → 检查数组大小是否超限，超限则缩减并重新生成
  → viewMode = 'compare'
  → SortVisualizer 渲染 CompareView
  → CompareView 渲染两个 CompareSlot（各自独立的 useSortAnimation 实例）
```

### 退出对比模式流程

```
用户点击"退出对比"按钮
  → store.exitCompareMode()
  → viewMode = 'single'
  → 恢复保存的算法
  → 恢复保存的数组大小（如果缩减过则重新生成）
  → SortVisualizer 渲染原有算法组件
```

### 时间同步播放

```
用户点击"播放"
  → CompareView.syncPlay()
  → leftSlot.play()  —— 独立 RAF 循环
  → rightSlot.play() —— 独立 RAF 循环
  → 两侧各自按自己的节奏运行，先完成的一侧自然停止
  → isAnyPlaying 任一侧仍在播放即为 true
```

### 布局切换

```
用户点击布局按钮
  → store.compareLayout 在 'horizontal' 和 'vertical' 之间切换
  → CSS flex-direction 改变
  → Canvas 组件通过 ResizeObserver 自动适应新尺寸
  → useSortAnimation watch canvasWidth/canvasHeight 变化 → rebuild()
```
