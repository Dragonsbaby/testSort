<script setup lang="ts">
import { ref, toRef, computed } from "vue";
import { quickSort } from "@/utils/sortingAlgorithms";
import SortBarCanvas from "@/components/SortBarCanvas.vue";
import { useSortStore } from "@/stores/sortStore";
import { useSortAnimation } from "@/composables/useSortAnimation";

const props = defineProps<{ speed: number }>();
const store = useSortStore();
const canvasRef = ref<InstanceType<typeof SortBarCanvas> | null>(null);

const { array, steps, currentStep, comparisons, swaps, highlightedIndices, currentStepInfo, isPlaying, play, pause, step, reset } = useSortAnimation({
  sortFn: quickSort,
  speed: toRef(props, "speed"),
  canvasRef,
  originalArray: toRef(store, "originalArray"),
});

defineExpose({ reset, step });

const statusText = computed(() => {
  if (isPlaying.value) return '播放中';
  if (currentStep.value >= steps.value.length) return '已完成';
  if (currentStep.value === 0) return '就绪';
  return '已暂停';
});

const statusClass = computed(() => {
  if (isPlaying.value) return 'playing';
  if (currentStep.value >= steps.value.length) return 'done';
  if (currentStep.value === 0) return 'ready';
  return 'paused';
});
</script>

<template>
  <div class="algorithm-view">
    <!-- Canvas -->
    <SortBarCanvas ref="canvasRef" :array="array" :highlighted-indices="highlightedIndices" :animation-speed="speed" />

    <!-- Combined stats bar with controls -->
    <div class="stats-bar">
      <!-- Left: Control buttons + stats (compact) -->
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

        <!-- Compact stats -->
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

      <!-- Right: Current operation -->
      <div class="stat-item operation-item" v-if="currentStepInfo">
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

/* Combined stats bar */
.stats-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 12px 20px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(74, 158, 255, 0.15);
  border-radius: 8px;
}

/* Left group: buttons + compact stats */
.stats-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* Control group (left) */
.ctrl-group {
  display: flex;
  gap: 8px;
}

.ctrl-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border: 1px solid rgba(74, 158, 255, 0.3);
  background: rgba(74, 158, 255, 0.08);
  color: #b4bcc8;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.ctrl-btn:hover:not(:disabled) {
  background: rgba(74, 158, 255, 0.15);
  border-color: rgba(74, 158, 255, 0.5);
  color: #e0e0e0;
}

.ctrl-btn:active:not(:disabled) {
  transform: scale(0.95);
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
  width: 14px;
  height: 14px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.stat-label {
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  color: #8b95a8;
  letter-spacing: 1px;
}

.stat-value {
  font-family: "JetBrains Mono", monospace;
  font-size: 18px;
  font-weight: 600;
  color: #5dddd4;
}

.stat-value.comparisons {
  color: #6bb3ff;
}

.stat-value.swaps {
  color: #ff8a8a;
}

.stat-value.steps {
  color: #5dddd4;
}

/* Status indicator */
.status-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  transition: background 0.2s ease, box-shadow 0.2s ease;
}

.status-indicator.ready .dot {
  background: #8b95a8;
}

.status-indicator.playing .dot {
  background: #5dddd4;
  box-shadow: 0 0 6px #5dddd4;
  animation: pulse 1s ease-in-out infinite;
}

.status-indicator.paused .dot {
  background: #ff8a8a;
}

.status-indicator.done .dot {
  background: #6bff6b;
}

.status-text {
  font-family: "JetBrains Mono", monospace;
  font-size: 12px;
  transition: color 0.2s ease;
}

.status-indicator.ready .status-text {
  color: #8b95a8;
}

.status-indicator.playing .status-text {
  color: #5dddd4;
}

.status-indicator.paused .status-text {
  color: #ff8a8a;
}

.status-indicator.done .status-text {
  color: #6bff6b;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(0.85); }
}

/* Operation (right) */
.operation-item {
  text-align: right;
  min-width: 180px;
}

.stat-value.operation {
  font-size: 12px;
  color: #a8b2c8;
}

.stat-divider {
  width: 1px;
  height: 32px;
  background: linear-gradient(
    180deg,
    transparent,
    rgba(74, 158, 255, 0.3) 50%,
    transparent
  );
}

@media (max-width: 700px) {
  .stats-bar {
    flex-wrap: wrap;
    justify-content: center;
    gap: 12px;
  }

  .stats-left {
    order: 1;
    flex-wrap: wrap;
    justify-content: center;
  }

  .operation-item {
    order: 2;
    width: 100%;
    text-align: center;
  }

  .stat-divider {
    display: none;
  }
}
</style>