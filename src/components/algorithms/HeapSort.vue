<script setup lang="ts">
import { ref, toRef, watch } from "vue";
import { heapSort } from "@/utils/sortingAlgorithms";
import SortBarCanvasHeap from "@/components/SortBarCanvasHeap.vue";
import { useSortStore } from "@/stores/sortStore";
import { useSortAnimation, type ISortCanvas } from "@/composables/useSortAnimation";

const props = defineProps<{ speed: number }>();
const store = useSortStore();
const canvasRef = ref<ISortCanvas | null>(null);

/** 堆模式：最大堆（升序）或最小堆（降序） */
const heapMode = ref<"max" | "min">("max");

const {
  array, steps, currentStep, comparisons, swaps,
  highlightedIndices, currentStepInfo,
  isPlaying, play, pause, step, stepBack, reset,
  statusText, statusClass,
} = useSortAnimation({
  sortFn: (arr) => heapSort(arr, heapMode.value),
  speed: toRef(props, "speed"),
  canvasRef,
  originalArray: toRef(store, "originalArray"),
});

// 切换模式时重新生成步骤（sortFn 闭包读取最新 heapMode.value）
watch(heapMode, () => {
  if (isPlaying.value) pause();
  reset(true);
});

defineExpose({ reset, step });
</script>

<template>
  <div class="algorithm-view">
    <div class="stats-bar">
      <!-- 左侧：控制按钮 + 统计 -->
      <div class="stats-left">
        <div class="ctrl-group">
          <button class="ctrl-btn" :class="{ active: isPlaying }" @click="isPlaying ? pause() : play()">
            <svg v-if="!isPlaying" class="btn-icon" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,3 19,12 5,21"/>
            </svg>
            <svg v-else class="btn-icon" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16"/>
              <rect x="14" y="4" width="4" height="16"/>
            </svg>
          </button>

          <button class="ctrl-btn" @click="stepBack()" :disabled="isPlaying || currentStep <= 0">
            <svg class="btn-icon" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="19,4 9,12 19,20"/>
              <rect x="5" y="4" width="3" height="16"/>
            </svg>
          </button>

          <button class="ctrl-btn" @click="step()" :disabled="isPlaying">
            <svg class="btn-icon" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,4 15,12 5,20"/>
              <rect x="16" y="4" width="3" height="16"/>
            </svg>
          </button>

          <button class="ctrl-btn" @click="reset()">
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
            </svg>
          </button>
        </div>

        <div class="stat-divider"></div>

        <div class="stat-item">
          <span class="stat-label">比较</span>
          <span class="stat-value comparisons">{{ comparisons }}</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <span class="stat-label">交换</span>
          <span class="stat-value swaps">{{ swaps }}</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <span class="stat-label">步骤</span>
          <span class="stat-value steps">{{ currentStep }}/{{ steps.length }}</span>
        </div>
        <div class="stat-divider"></div>
        <div class="status-indicator" :class="statusClass">
          <span class="dot"></span>
          <span class="status-text">{{ statusText }}</span>
        </div>
      </div>

      <!-- 右侧：堆模式切换 + 当前操作 -->
      <div class="stats-right">
        <div class="heap-mode-wrap">
          <span class="stat-label">堆模式</span>
          <div class="mode-toggle">
            <button
              class="mode-btn"
              :class="{ 'mode-max': heapMode === 'max' }"
              @click="heapMode = 'max'"
            >最大堆</button>
            <button
              class="mode-btn"
              :class="{ 'mode-min': heapMode === 'min' }"
              @click="heapMode = 'min'"
            >最小堆</button>
          </div>
        </div>

        <div class="stat-divider"></div>

        <div class="stat-item operation-item" v-if="currentStepInfo">
          <span class="stat-label">当前操作</span>
          <span class="stat-value operation">{{ currentStepInfo.description }}</span>
        </div>
      </div>
    </div>

    <!-- Canvas -->
    <SortBarCanvasHeap
      ref="canvasRef"
      :array="array"
      :highlighted-indices="highlightedIndices"
      :animation-speed="speed"
      :is-min-heap="heapMode === 'min'"
    />
  </div>
</template>

<style lang="scss" scoped>
@use './algorithm-common';

.stats-right {
  display: flex;
  align-items: center;
  gap: 14px;
}

.heap-mode-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

.mode-toggle {
  display: flex;
  border: 1px solid rgba(74, 158, 255, 0.2);
  border-radius: 7px;
  overflow: hidden;
}

.mode-btn {
  padding: 5px 13px;
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  background: rgba(10, 10, 20, 0.6);
  color: #8b95a8;
  transition: all 0.15s;

  &:first-child {
    border-right: 1px solid rgba(74, 158, 255, 0.15);
  }

  &.mode-max {
    background: rgba(255, 159, 64, 0.18);
    color: #ff9f40;
  }

  &.mode-min {
    background: rgba(78, 205, 196, 0.15);
    color: #4ecdc4;
  }
}
</style>
