<script setup lang="ts">
import { ref, toRef } from "vue";
import { bucketSort } from "@/utils/sortingAlgorithms";
import SortBarCanvasBucket from "@/components/SortBarCanvasBucket.vue";
import { useSortStore } from "@/stores/sortStore";
import { useSortAnimation, type ISortCanvas } from "@/composables/useSortAnimation";

const props = defineProps<{ speed: number }>();
const store = useSortStore();
const canvasRef = ref<ISortCanvas | null>(null);
const canvasWidthRef = ref(760);
const canvasHeightRef = ref(520);

const {
  array, steps, currentStep, comparisons, swaps,
  currentStepInfo, isPlaying, play, pause, step: stepOnce,
  reset, statusText, statusClass,
} = useSortAnimation({
  sortFn: bucketSort,
  speed: toRef(props, "speed"),
  canvasRef,
  canvasWidth: canvasWidthRef,
  canvasHeight: canvasHeightRef,
  originalArray: toRef(store, "originalArray"),
  algorithm: "bucket",
});

defineExpose({ reset, step: stepOnce });
</script>

<template>
  <div class="algorithm-view">
    <!-- 统计栏 + 控制按钮 -->
    <div class="stats-bar">
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

          <button class="ctrl-btn" @click="stepOnce()" :disabled="isPlaying || currentStep >= steps.length">
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

      <div class="stat-item operation-item" v-if="currentStepInfo">
        <span class="stat-label">当前操作</span>
        <span class="stat-value operation">{{ currentStepInfo.description }}</span>
      </div>
    </div>

    <!-- 桶排序专用 Canvas（含双区域：主数组 + 桶区） -->
    <SortBarCanvasBucket
      ref="canvasRef"
      :array="array"
      :animation-speed="speed"
      @canvas-ready="canvasWidthRef = $event.width; canvasHeightRef = $event.height"
    />
  </div>
</template>

<style lang="scss" scoped>
@use './algorithm-common';
</style>
