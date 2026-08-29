<script setup lang="ts">
import { ref, toRef, watch } from "vue";
import { heapSort } from "@/utils/sortingAlgorithms";
import SortBarCanvas from "@/components/SortBarCanvas.vue";
import { useSortStore } from "@/stores/sortStore";
import { useSortAnimation, type ISortCanvas } from "@/composables/useSortAnimation";
import { useKeyboardShortcuts } from "@/composables/useKeyboardShortcuts";
import PlaybackButton from "@/components/common/PlaybackButton.vue";

const props = defineProps<{ speed: number }>();
const store = useSortStore();
const canvasRef = ref<ISortCanvas | null>(null);
const canvasWidthRef = ref(760);

const heapMode = ref<"max" | "min">("max");

const {
  array, steps, currentStep,
  isPlaying, isReady, play, pause,
  step: stepOnce, stepBack, reset, rebuild, statusText, statusClass,
  progressPct, phase, desc, handleSeek,
} = useSortAnimation({
  sortFn: (arr) => heapSort(arr, heapMode.value),
  speed: toRef(props, "speed"),
  canvasRef,
  canvasWidth: canvasWidthRef,
  originalArray: toRef(store, "originalArray"),
  algorithm: "heap",
  heapMode,
});

watch(heapMode, () => {
  if (isPlaying.value) pause();
  rebuild();
});

defineExpose({ reset, step: stepOnce });

useKeyboardShortcuts({
  onPlayPause: () => isPlaying.value ? pause() : play(),
  onStop: reset,
  onStepForward: stepOnce,
  onStepBack: stepBack,
});
</script>

<template>
  <div class="algorithm-view">
    <div class="stats-bar">
      <div class="pb-controls">
        <PlaybackButton icon="step-back" title="单步后退 ←" :disabled="!isReady || currentStep === 0" @click="stepBack()" />
        <PlaybackButton :icon="isPlaying ? 'pause' : 'play'" title="播放/暂停 Space" :active="isPlaying" :disabled="!isReady" @click="isPlaying ? pause() : play()" />
        <PlaybackButton icon="step-forward" title="单步前进 →" :disabled="!isReady || isPlaying || currentStep >= steps.length" @click="stepOnce()" />
        <PlaybackButton icon="reset" title="重置 Home" @click="reset()" />
        <!-- 堆模式切换：最大堆↑ / 最小堆↓ -->
        <button
          class="pb-btn heap-mode-btn"
          :class="heapMode"
          @click="heapMode = heapMode === 'max' ? 'min' : 'max'"
          :title="heapMode === 'max' ? '当前：最大堆，点击切换为最小堆' : '当前：最小堆，点击切换为最大堆'"
          :aria-label="heapMode === 'max' ? '切换为最小堆' : '切换为最大堆'"
        >
          <svg v-if="heapMode === 'max'" class="pb-icon" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="12,4 20,16 4,16"/>
          </svg>
          <svg v-else class="pb-icon" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="12,20 20,8 4,8"/>
          </svg>
        </button>
      </div>
      <div class="pb-progress">
        <div class="pb-track-wrap" @click="handleSeek">
          <div class="pb-track"><div class="pb-fill" :style="{ width: progressPct + '%' }"></div></div>
          <div class="pb-handle" :style="{ left: progressPct + '%' }"></div>
        </div>
        <span class="pb-step-count">{{ currentStep }}/{{ steps.length }}</span>
      </div>
      <div class="pb-desc" :class="statusClass">
        <span class="dot"></span>
        <span class="pb-status-text">{{ statusText }}</span>
        <span v-if="phase" class="pb-phase-sep">·</span>
        <span v-if="phase" class="pb-phase">{{ phase }}</span>
        <span v-if="desc" class="pb-phase-sep">›</span>
        <span v-if="desc" class="pb-desc-text">{{ desc }}</span>
      </div>
      <div class="pb-kbd">
        <kbd class="kbd">Space</kbd>
        <kbd class="kbd">← →</kbd>
        <kbd class="kbd">Home</kbd>
      </div>
    </div>

    <SortBarCanvas
      ref="canvasRef"
      variant="heap"
      :array="array"
      @canvas-ready="canvasWidthRef = $event.width"
    />
  </div>
</template>

<style lang="scss" scoped>
@use './algorithm-common';

/* 堆模式按钮：max 走 swapping 系、min 走 accent 系（与 CompareSlot 同一语义） */
.heap-mode-btn.max {
  color: var(--swapping);
  border-color: var(--swapping);
}

.heap-mode-btn.min {
  color: var(--accent);
  border-color: var(--accent);
}
</style>
