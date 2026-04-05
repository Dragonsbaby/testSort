<script setup lang="ts">
import { ref, toRef } from "vue";
import { bubbleSort } from "@/utils/sortingAlgorithms";
import SortBarCanvas from "@/components/SortBarCanvas.vue";
import { useSortStore } from "@/stores/sortStore";
import { useSortAnimation } from "@/composables/useSortAnimation";

const props = defineProps<{ isPlaying: boolean; speed: number }>();
const store = useSortStore();
const canvasRef = ref<InstanceType<typeof SortBarCanvas> | null>(null);

const { array, comparisons, swaps, highlightedIndices, currentStepInfo, steps, currentStep, generateArray, reset, step } = useSortAnimation({
  sortFn: bubbleSort,
  isPlaying: toRef(props, "isPlaying"),
  speed: toRef(props, "speed"),
  arraySize: toRef(store, "arraySize"),
  canvasRef,
});

defineExpose({ generateArray, reset, step });
</script>

<template>
  <div class="algorithm-view">
    <SortBarCanvas ref="canvasRef" :array="array" :highlighted-indices="highlightedIndices" :animation-speed="speed" />
    <footer class="stats-bar">
      <div class="stat"><span class="stat-label">比较次数</span><span class="stat-value">{{ comparisons }}</span></div>
      <div class="stat"><span class="stat-label">交换次数</span><span class="stat-value">{{ swaps }}</span></div>
      <div class="stat"><span class="stat-label">当前步骤</span><span class="stat-value">{{ currentStep }} / {{ steps.length }}</span></div>
      <div class="stat description" v-if="currentStepInfo"><span class="stat-label">操作</span><span class="stat-value desc">{{ currentStepInfo.description }}</span></div>
    </footer>
  </div>
</template>

<style scoped>
@import "@/styles/shared.css";
</style>
