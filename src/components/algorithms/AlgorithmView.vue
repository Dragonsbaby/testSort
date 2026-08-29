<script setup lang="ts">
import { ref, toRef, watch } from "vue";
import SortBarCanvas from "@/components/SortBarCanvas.vue";
import { CANVAS_VARIANT_BY_ALGORITHM } from "@/components/canvas-variant";
import { useSortStore } from "@/stores/sortStore";
import { useSortAnimation, type ISortCanvas, type SortAnimationAlgorithm, type SortFn } from "@/composables/useSortAnimation";
import { SORT_FNS, heapSort } from "@/utils/sortingAlgorithms";
import { useKeyboardShortcuts } from "@/composables/useKeyboardShortcuts";
import PlaybackButton from "@/components/common/PlaybackButton.vue";

/**
 * 全部 7 个排序算法的通用视图。
 * SortVisualizer 按 algorithm 字面量 :key 挂载（切换算法即重挂载）；
 * 本组件承载全部共用逻辑、模板与键盘注册，heap 算法额外携带最大/最小堆切换。
 */
const props = defineProps<{
  algorithm: SortAnimationAlgorithm;
  speed: number;
}>();

const store = useSortStore();
const canvasRef = ref<ISortCanvas | null>(null);
const canvasWidthRef = ref(760);

/* merge/bucket 双排布局需要真实画布高度；basic 固定 320、heap 动态，均不接线 */
const needsCanvasHeight = props.algorithm === "merge" || props.algorithm === "bucket";
const canvasHeightRef = ref(props.algorithm === "bucket" ? 520 : 460);

const heapMode = ref<"max" | "min">("max");

/** heap 在调用期读取 heapMode（切模式后由 rebuild 重新执行） */
const sortFn: SortFn = (arr) => props.algorithm === "heap"
  ? heapSort(arr, heapMode.value)
  : SORT_FNS[props.algorithm](arr);

const { array, steps, currentStep, isPlaying, isReady, play, pause, step, stepBack, reset, rebuild, statusText, statusClass, progressPct, phase, desc, handleSeek } = useSortAnimation({
  sortFn,
  speed: toRef(props, "speed"),
  canvasRef,
  canvasWidth: canvasWidthRef,
  ...(needsCanvasHeight ? { canvasHeight: canvasHeightRef } : {}),
  originalArray: toRef(store, "originalArray"),
  algorithm: props.algorithm,
  ...(props.algorithm === "heap" ? { heapMode } : {}),
});

/* 堆模式切换时重建（仅 heap 渲染切换按钮，此处注册对其他算法为空操作） */
watch(heapMode, () => {
  if (isPlaying.value) pause();
  rebuild();
});

useKeyboardShortcuts({
  onPlayPause: () => isPlaying.value ? pause() : play(),
  onStop: reset,
  onStepForward: step,
  onStepBack: stepBack,
});

function onCanvasReady(size: { width: number; height: number }) {
  canvasWidthRef.value = size.width;
  if (needsCanvasHeight) canvasHeightRef.value = size.height;
}

defineExpose({ reset, step });
</script>

<template>
  <div class="algorithm-view">
    <div class="stats-bar">
      <div class="pb-controls">
        <PlaybackButton icon="step-back" title="单步后退 ←" :disabled="!isReady || currentStep === 0" @click="stepBack()" />
        <PlaybackButton :icon="isPlaying ? 'pause' : 'play'" title="播放/暂停 Space" :active="isPlaying" :disabled="!isReady" @click="isPlaying ? pause() : play()" />
        <PlaybackButton icon="step-forward" title="单步前进 →" :disabled="!isReady || isPlaying || currentStep >= steps.length" @click="step()" />
        <PlaybackButton icon="reset" title="重置 Home" @click="reset()" />
        <!-- 堆模式切换：最大堆↑ / 最小堆↓ -->
        <button
          v-if="algorithm === 'heap'"
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
      :variant="CANVAS_VARIANT_BY_ALGORITHM[algorithm]"
      :array="array"
      @canvas-ready="onCanvasReady"
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
