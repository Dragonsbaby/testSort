<script setup lang="ts">
import { ref, toRef } from "vue";
import { quickSort } from "@/utils/sortingAlgorithms";
import SortBarCanvas from "@/components/SortBarCanvas.vue";
import { useSortStore } from "@/stores/sortStore";
import { useSortAnimation, type ISortCanvas } from "@/composables/useSortAnimation";
import { useKeyboardShortcuts } from "@/composables/useKeyboardShortcuts";

const props = defineProps<{ speed: number }>();
const store = useSortStore();
const canvasRef = ref<ISortCanvas | null>(null);
const canvasWidthRef = ref(760);

const { array, steps, currentStep, isPlaying, isReady, play, pause, step, stepBack, reset, statusText, statusClass, progressPct, phase, desc, handleSeek } = useSortAnimation({
  sortFn: quickSort,
  speed: toRef(props, "speed"),
  canvasRef,
  canvasWidth: canvasWidthRef,
  originalArray: toRef(store, "originalArray"),
  algorithm: "quick",
});

useKeyboardShortcuts({
  onPlayPause: () => isPlaying.value ? pause() : play(),
  onStop: reset,
  onStepForward: step,
  onStepBack: stepBack,
});

defineExpose({ reset, step });
</script>

<template>
  <div class="algorithm-view">
    <div class="stats-bar">
      <div class="pb-controls">
        <button class="pb-btn" :disabled="!isReady || currentStep === 0" @click="stepBack()" title="单步后退 ←">
          <svg class="pb-icon" viewBox="0 0 24 24" fill="currentColor"><polygon points="19,4 9,12 19,20"/><rect x="5" y="4" width="3" height="16"/></svg>
        </button>
        <button class="pb-btn" :class="{ active: isPlaying }" :disabled="!isReady" @click="isPlaying ? pause() : play()" title="播放/暂停 Space">
          <svg v-if="!isPlaying" class="pb-icon" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
          <svg v-else class="pb-icon" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
        </button>
        <button class="pb-btn" :disabled="!isReady || isPlaying || currentStep >= steps.length" @click="step()" title="单步前进 →">
          <svg class="pb-icon" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,4 15,12 5,20"/><rect x="16" y="4" width="3" height="16"/></svg>
        </button>
        <button class="pb-btn" @click="reset()" title="重置 Home">
          <svg class="pb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
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

    <SortBarCanvas ref="canvasRef" :array="array" :animation-speed="speed" @canvas-ready="canvasWidthRef = $event" />
  </div>
</template>

<style lang="scss" scoped>
@use './algorithm-common';
</style>