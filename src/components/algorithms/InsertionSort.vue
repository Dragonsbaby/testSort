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
    <div class="control-bar">
      <div class="status-indicator" :class="{ playing: isPlaying }">
        <span class="dot"></span>
        <span class="status-text">{{ isPlaying ? '运行中' : '空闲' }}</span>
      </div>

      <div class="controls">
        <button class="ctrl-btn" :class="{ active: isPlaying }" @click="isPlaying ? pause() : play()">
          <svg v-if="!isPlaying" class="btn-icon" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5,3 19,12 5,21"/>
          </svg>
          <svg v-else class="btn-icon" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16"/>
            <rect x="14" y="4" width="4" height="16"/>
          </svg>
          {{ isPlaying ? '暂停' : '开始' }}
        </button>

        <button class="ctrl-btn" @click="step()" :disabled="isPlaying">
          <svg class="btn-icon" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5,4 15,12 5,20"/>
            <rect x="16" y="4" width="3" height="16"/>
          </svg>
          单步
        </button>

        <button class="ctrl-btn" @click="reset()">
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8"/>
            <path d="M3 3v5h5"/>
          </svg>
          重置
        </button>
      </div>

      <div class="step-counter">
        <span class="counter-label">步骤</span>
        <span class="counter-value">{{ currentStep }} / {{ steps.length }}</span>
      </div>
    </div>

    <SortBarCanvas ref="canvasRef" :array="array" :highlighted-indices="highlightedIndices" :animation-speed="speed" />

    <div class="stats-bar">
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
      <div class="stat-item wide" v-if="currentStepInfo">
        <span class="stat-label">当前操作</span>
        <span class="stat-value operation">{{ currentStepInfo.description }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.algorithm-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 12px;
}

.control-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(74, 158, 255, 0.15);
  border-radius: 8px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #5a6a8a;
  transition: all 0.3s ease;
}

.status-indicator.playing .dot {
  background: #4ecdc4;
  box-shadow: 0 0 10px rgba(78, 205, 196, 0.8);
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.status-text {
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  color: #8b95a8;
  letter-spacing: 2px;
}

.status-indicator.playing .status-text {
  color: #4ecdc4;
}

.controls {
  display: flex;
  gap: 8px;
}

.ctrl-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: "JetBrains Mono", monospace;
  font-size: 12px;
  padding: 10px 16px;
  border: 1px solid rgba(74, 158, 255, 0.3);
  background: rgba(74, 158, 255, 0.08);
  color: #b4bcc8;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  letter-spacing: 1px;
}

.ctrl-btn:hover:not(:disabled) {
  background: rgba(74, 158, 255, 0.15);
  border-color: rgba(74, 158, 255, 0.5);
  color: #e0e0e0;
}

.ctrl-btn:active:not(:disabled) {
  transform: scale(0.97);
}

.ctrl-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.ctrl-btn.active {
  background: rgba(255, 107, 107, 0.15);
  border-color: rgba(255, 107, 107, 0.4);
  color: #ff6b6b;
}

.btn-icon {
  width: 12px;
  height: 12px;
}

.step-counter {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.counter-label {
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  color: #8b95a8;
  letter-spacing: 1px;
}

.counter-value {
  font-family: "JetBrains Mono", monospace;
  font-size: 16px;
  color: #6bb3ff;
  font-weight: 600;
}

.stats-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(74, 158, 255, 0.15);
  border-radius: 8px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.stat-item.wide {
  min-width: 200px;
  text-align: center;
}

.stat-label {
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  color: #8b95a8;
  letter-spacing: 1px;
}

.stat-value {
  font-family: "JetBrains Mono", monospace;
  font-size: 20px;
  font-weight: 600;
  color: #5dddd4;
}

.stat-value.comparisons {
  color: #6bb3ff;
}

.stat-value.swaps {
  color: #ff8a8a;
}

.stat-value.operation {
  font-size: 13px;
  color: #a8b2c8;
  text-transform: uppercase;
}

.stat-divider {
  width: 1px;
  height: 35px;
  background: linear-gradient(
    180deg,
    transparent,
    rgba(74, 158, 255, 0.3) 50%,
    transparent
  );
}

@media (max-width: 600px) {
  .control-bar {
    flex-direction: column;
    gap: 12px;
  }

  .stats-bar {
    flex-wrap: wrap;
    gap: 16px;
  }

  .stat-divider {
    display: none;
  }
}
</style>