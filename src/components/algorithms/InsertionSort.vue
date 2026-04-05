<script setup lang="ts">
import { ref, toRef } from "vue";
import { insertionSort } from "@/utils/sortingAlgorithms";
import SortBarCanvas from "@/components/SortBarCanvas.vue";
import { useSortStore } from "@/stores/sortStore";
import { useSortAnimation } from "@/composables/useSortAnimation";

const props = defineProps<{ speed: number }>();
const store = useSortStore();
const canvasRef = ref<InstanceType<typeof SortBarCanvas> | null>(null);

const { array, comparisons, swaps, highlightedIndices, currentStepInfo, steps, currentStep, isPlaying, play, pause, step, reset } = useSortAnimation({
  sortFn: insertionSort,
  speed: toRef(props, "speed"),
  canvasRef,
  originalArray: toRef(store, "originalArray"),
});

defineExpose({ reset, step });
</script>

<template>
  <div class="algorithm-view">
    <div class="controls">
      <button class="ctrl-btn" :class="{ active: isPlaying }" @click="isPlaying ? pause() : play()">
        {{ isPlaying ? "暂停" : "开始" }}
      </button>
      <button class="ctrl-btn" @click="step()" :disabled="isPlaying">
        单步
      </button>
      <button class="ctrl-btn" @click="reset()">
        重置
      </button>
    </div>
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

.controls {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-bottom: 16px;
}

.ctrl-btn {
  font-family: "JetBrains Mono", monospace;
  font-size: 13px;
  padding: 8px 20px;
  border: 1px solid rgba(74, 158, 255, 0.4);
  background: rgba(74, 158, 255, 0.1);
  color: #4a9eff;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 80px;
}

.ctrl-btn:hover:not(:disabled) {
  background: rgba(74, 158, 255, 0.2);
  transform: translateY(-1px);
}

.ctrl-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.ctrl-btn.active {
  background: rgba(255, 107, 107, 0.2);
  border-color: rgba(255, 107, 107, 0.4);
  color: #ff6b6b;
}
</style>