<script setup lang="ts">
import { ref, toRef } from "vue";
import { bubbleSort } from "@/utils/sortingAlgorithms";
import SortBarCanvas from "@/components/SortBarCanvas.vue";
import { useSortStore } from "@/stores/sortStore";
import { useSortAnimation, type ISortCanvas } from "@/composables/useSortAnimation";
import EnhancedControlPanel from "./EnhancedControlPanel.vue";
import ControlPanel from "./ControlPanel.vue";

const store = useSortStore();
const canvasRef = ref<ISortCanvas | null>(null);
const canvasWidthRef = ref(760);

const {
  array,
  currentStep,
  currentProgress,
  totalSteps,
  comparisons,
  swaps,
  currentStepInfo,
  isPlaying,
  play,
  pause,
  step,
  stepBack,
  seek,
  reset,
  canStepForward,
  canStepBack,
  isAtStart,
  isAtEnd
} = useSortAnimation({
  sortFn: bubbleSort,
  speed: toRef(store, 'animationSpeed'),
  canvasRef,
  canvasWidth: canvasWidthRef,
  originalArray: toRef(store, 'originalArray'),
  algorithm: "bubble",
});

defineExpose({ reset, step });
</script>

<template>
  <div class="test-playback-view">
    <!-- 增强控制面板 -->
    <EnhancedControlPanel
      :is-playing="isPlaying"
      :current-step="currentStep"
      :total-steps="totalSteps"
      :current-progress="currentProgress"
      :comparisons="comparisons"
      :swaps="swaps"
      :current-step-info="currentStepInfo"
      :can-step-forward="canStepForward"
      :can-step-back="canStepBack"
      :is-at-start="isAtStart"
      :is-at-end="isAtEnd"
      :on-play="play"
      :on-pause="pause"
      :on-reset="reset"
      :on-step-forward="step"
      :on-step-back="stepBack"
      :on-seek="seek"
    >
      <!-- 插入原始控制面板 -->
      <ControlPanel />
    </EnhancedControlPanel>

    <!-- 画布区域 -->
    <div class="canvas-container">
      <SortBarCanvas
        ref="canvasRef"
        :array="array"
        :animation-speed="store.animationSpeed"
        @canvas-ready="canvasWidthRef = $event"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.test-playback-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
}

.canvas-container {
  position: relative;
  background: rgba(10, 10, 20, 0.8);
  border: 1px solid rgba(74, 158, 255, 0.15);
  border-radius: 12px;
  padding: 16px;
  min-height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
