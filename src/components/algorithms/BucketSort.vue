<script setup lang="ts">
import { ref, toRef } from "vue";
import { bucketSort } from "@/utils/sortingAlgorithms";
import SortBarCanvasBucket from "@/components/SortBarCanvasBucket.vue";
import { useSortStore } from "@/stores/sortStore";
import { useSortAnimation, type ISortCanvas } from "@/composables/useSortAnimation";
import { useKeyboardShortcuts } from "@/composables/useKeyboardShortcuts";
import PlaybackButton from "@/components/common/PlaybackButton.vue";

const props = defineProps<{ speed: number }>();
const store = useSortStore();
const canvasRef = ref<ISortCanvas | null>(null);
const canvasWidthRef = ref(760);
const canvasHeightRef = ref(520);

const {
  array, steps, currentStep,
  isPlaying, isReady, play, pause, step: stepOnce,
  stepBack, reset, statusText, statusClass,
  progressPct, phase, desc, handleSeek,
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
