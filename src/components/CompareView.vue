<script setup lang="ts">
import { ref, computed } from "vue";
import { useSortStore } from "@/stores/sortStore";
import { getCompareMaxArraySize } from "@/composables/useCompareUtils";
import { algorithmInfo } from "@/types/sorting";
import type { SortAlgorithm } from "@/types/sorting";
import CompareSlot from "@/components/CompareSlot.vue";

const store = useSortStore();

/* ── Slot 模板引用 ── */
const leftSlot = ref<InstanceType<typeof CompareSlot> | null>(null);
const rightSlot = ref<InstanceType<typeof CompareSlot> | null>(null);

/* ── 布局切换 ── */
const isHorizontal = computed(() => store.compareLayout === "horizontal");

function toggleLayout() {
  store.setCompareLayout(isHorizontal.value ? "vertical" : "horizontal");
}

/* ── 共享播放控制（时间同步模式） ── */
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

/* ── 播放状态（事件驱动，避免模板 ref 响应式追踪失效） ── */
const leftPlaying = ref(false);
const rightPlaying = ref(false);
const isAnyPlaying = computed(() => leftPlaying.value || rightPlaying.value);

interface SlotStats {
  algorithm: SortAlgorithm;
  comparisons: number;
  swaps: number;
  currentStep: number;
  totalSteps: number;
}

const leftStats = ref<SlotStats>({ algorithm: "bubble", comparisons: 0, swaps: 0, currentStep: 0, totalSteps: 0 });
const rightStats = ref<SlotStats>({ algorithm: "quick", comparisons: 0, swaps: 0, currentStep: 0, totalSteps: 0 });

const statsDiff = computed(() => {
  const compDiff = leftStats.value.comparisons - rightStats.value.comparisons;
  const swapDiff = leftStats.value.swaps - rightStats.value.swaps;
  return {
    comparisons: compDiff,
    swaps: swapDiff,
    compWinner: compDiff < 0 ? "left" : compDiff > 0 ? "right" : "tie" as "left" | "right" | "tie",
    swapWinner: swapDiff < 0 ? "left" : swapDiff > 0 ? "right" : "tie" as "left" | "right" | "tie",
  };
});

function formatDiff(val: number): string {
  if (val === 0) return "0";
  return val > 0 ? `+${val}` : `${val}`;
}

/* ── 算法切换 + 大小限制 ── */
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

/* ── 退出对比模式 ── */
function exitCompare() {
  store.exitCompareMode();
}
</script>

<template>
  <div class="compare-view">
    <!-- 双 Slot 容器 -->
    <div class="compare-slots" :class="store.compareLayout">
      <CompareSlot
        ref="leftSlot"
        :key="store.leftAlgorithm"
        :algorithm="store.leftAlgorithm"
        :speed="store.animationSpeed"
        :disabled-algorithm="store.rightAlgorithm"
        @update:algorithm="handleLeftAlgorithmChange"
        @update:playing="v => leftPlaying = v"
        @update:stats="v => leftStats = v"
      />
      <CompareSlot
        ref="rightSlot"
        :key="store.rightAlgorithm"
        :algorithm="store.rightAlgorithm"
        :speed="store.animationSpeed"
        :disabled-algorithm="store.leftAlgorithm"
        @update:algorithm="handleRightAlgorithmChange"
        @update:playing="v => rightPlaying = v"
        @update:stats="v => rightStats = v"
      />
    </div>

    <!-- 汇总对比面板 -->
    <div class="compare-summary" v-if="leftStats.totalSteps > 0 && rightStats.totalSteps > 0">
      <div class="summary-col">
        <span class="summary-algo-name">{{ algorithmInfo[leftStats.algorithm].name }}</span>
        <div class="summary-metrics">
          <div class="summary-metric">
            <span class="metric-label">比较</span>
            <span class="metric-value">{{ leftStats.comparisons }}</span>
          </div>
          <div class="summary-metric">
            <span class="metric-label">交换</span>
            <span class="metric-value">{{ leftStats.swaps }}</span>
          </div>
        </div>
      </div>

      <div class="summary-center">
        <div class="diff-row">
          <span class="diff-label">比较差</span>
          <span class="diff-value" :class="'winner-' + statsDiff.compWinner">
            {{ formatDiff(statsDiff.comparisons) }}
          </span>
        </div>
        <div class="diff-row">
          <span class="diff-label">交换差</span>
          <span class="diff-value" :class="'winner-' + statsDiff.swapWinner">
            {{ formatDiff(statsDiff.swaps) }}
          </span>
        </div>
      </div>

      <div class="summary-col">
        <span class="summary-algo-name">{{ algorithmInfo[rightStats.algorithm].name }}</span>
        <div class="summary-metrics">
          <div class="summary-metric">
            <span class="metric-label">比较</span>
            <span class="metric-value">{{ rightStats.comparisons }}</span>
          </div>
          <div class="summary-metric">
            <span class="metric-label">交换</span>
            <span class="metric-value">{{ rightStats.swaps }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 共享控制栏 -->
    <div class="compare-controls">
      <!-- 布局切换按钮 -->
      <button class="ctrl-btn layout-btn" @click="toggleLayout" title="切换布局">
        <svg class="ctrl-icon" viewBox="0 0 24 24" fill="currentColor">
          <!-- 水平布局图标：两列 -->
          <template v-if="isHorizontal">
            <rect x="3" y="4" width="7" height="16" rx="1.5" />
            <rect x="14" y="4" width="7" height="16" rx="1.5" />
          </template>
          <!-- 垂直布局图标：两行 -->
          <template v-else>
            <rect x="4" y="3" width="16" height="7" rx="1.5" />
            <rect x="4" y="14" width="16" height="7" rx="1.5" />
          </template>
        </svg>
      </button>

      <span class="ctrl-divider"></span>

      <!-- 播放控制：stepBack / play-pause / step / reset -->
      <button class="ctrl-btn" @click="syncStepBack" title="单步后退">
        <svg class="ctrl-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
        </svg>
      </button>

      <button
        class="ctrl-btn play-pause-btn"
        :class="{ active: isAnyPlaying }"
        @click="isAnyPlaying ? syncPause() : syncPlay()"
        :title="isAnyPlaying ? '暂停' : '播放'"
      >
        <svg class="ctrl-icon" viewBox="0 0 24 24" fill="currentColor">
          <path v-if="!isAnyPlaying" d="M8 5v14l11-7z" />
          <path v-else d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
        </svg>
      </button>

      <button class="ctrl-btn" @click="syncStep" title="单步前进">
        <svg class="ctrl-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
        </svg>
      </button>

      <button class="ctrl-btn" @click="syncReset" title="重置">
        <svg class="ctrl-icon" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="6" width="12" height="12" rx="1" />
        </svg>
      </button>

      <span class="ctrl-divider"></span>

      <!-- 退出对比按钮 -->
      <button class="ctrl-btn exit-btn" @click="exitCompare" title="退出对比模式">
        <svg class="ctrl-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        <span class="exit-label">退出</span>
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
/* ── 根容器 ── */
.compare-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: 12px;
}

/* ── 双 Slot 容器 ── */
.compare-slots {
  display: flex;
  flex: 1;
  gap: 12px;
  min-height: 0;

  &.horizontal {
    flex-direction: row;

    > * {
      flex: 1;
      min-width: 0;
    }
  }

  &.vertical {
    flex-direction: column;

    > * {
      flex: 1;
      min-height: 0;
    }
  }
}

/* ── 控制栏 ── */
.compare-controls {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 0 20px;
  height: 48px;
  background: rgba(10, 10, 20, 0.7);
  border: 1px solid rgba(74, 158, 255, 0.12);
  border-radius: 10px;
  backdrop-filter: blur(12px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
  flex-shrink: 0;
}

/* ── 通用控制按钮 ── */
.ctrl-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid rgba(74, 158, 255, 0.2);
  background: rgba(74, 158, 255, 0.05);
  color: #8b95a8;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;

  &:hover:not(:disabled) {
    background: rgba(74, 158, 255, 0.12);
    border-color: rgba(74, 158, 255, 0.35);
    color: #c0c8d8;
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
}

.ctrl-icon {
  width: 11px;
  height: 11px;
}

/* ── 布局切换按钮 ── */
.layout-btn {
  color: #4ecdc4;
  border-color: rgba(78, 205, 196, 0.3);
  background: rgba(78, 205, 196, 0.06);

  &:hover {
    color: #6eeee5;
    background: rgba(78, 205, 196, 0.15);
    border-color: rgba(78, 205, 196, 0.5);
  }
}

/* ── 播放/暂停按钮 ── */
.play-pause-btn {
  width: 32px;
  height: 28px;
  color: #4ecdc4;
  border-color: rgba(78, 205, 196, 0.35);
  background: rgba(78, 205, 196, 0.08);

  &.active {
    color: #ff8a8a;
    border-color: rgba(255, 138, 138, 0.3);
    background: rgba(255, 138, 138, 0.07);
  }

  &:hover:not(:disabled) {
    background: rgba(78, 205, 196, 0.18);
    border-color: rgba(78, 205, 196, 0.5);
    color: #6eeee5;

    &.active {
      background: rgba(255, 138, 138, 0.14);
      border-color: rgba(255, 138, 138, 0.5);
      color: #ffaaaa;
    }
  }
}

/* ── 分隔线 ── */
.ctrl-divider {
  width: 1px;
  height: 20px;
  background: rgba(74, 158, 255, 0.1);
  margin: 0 8px;
  flex-shrink: 0;
}

/* ── 退出按钮 ── */
.exit-btn {
  margin-left: auto;
  width: auto;
  padding: 0 10px;
  gap: 4px;
  color: #ff8a8a;
  border-color: rgba(255, 138, 138, 0.25);
  background: rgba(255, 138, 138, 0.06);

  &:hover {
    color: #ffaaaa;
    background: rgba(255, 138, 138, 0.14);
    border-color: rgba(255, 138, 138, 0.45);
  }
}

.exit-label {
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  font-weight: 600;
  white-space: nowrap;
}

/* ── 汇总对比面板 ── */
.compare-summary {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 20px;
  background: rgba(10, 10, 20, 0.6);
  border: 1px solid rgba(74, 158, 255, 0.12);
  border-radius: 8px;
  backdrop-filter: blur(12px);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
  flex-shrink: 0;
}

.summary-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex: 1;
}

.summary-algo-name {
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  color: #8b95a8;
  font-weight: 600;
}

.summary-metrics {
  display: flex;
  gap: 12px;
}

.summary-metric {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}

.metric-label {
  font-family: "JetBrains Mono", monospace;
  font-size: 9px;
  color: #6b7280;
}

.metric-value {
  font-family: "JetBrains Mono", monospace;
  font-size: 13px;
  color: #5dddd4;
  font-weight: 600;
}

.summary-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 0 12px;
  border-left: 1px solid rgba(74, 158, 255, 0.1);
  border-right: 1px solid rgba(74, 158, 255, 0.1);
}

.diff-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.diff-label {
  font-family: "JetBrains Mono", monospace;
  font-size: 9px;
  color: #6b7280;
  white-space: nowrap;
}

.diff-value {
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  font-weight: 600;
  min-width: 50px;
  text-align: right;
}

.diff-value.winner-left { color: #4ecdc4; }
.diff-value.winner-right { color: #ff8a8a; }
.diff-value.winner-tie { color: #8b95a8; }

/* ── 响应式：窄屏下 horizontal 降级为 vertical ── */
@media (max-width: 900px) {
  .compare-slots.horizontal {
    flex-direction: column;

    > * {
      flex: 1;
      min-height: 0;
    }
  }
}
</style>
