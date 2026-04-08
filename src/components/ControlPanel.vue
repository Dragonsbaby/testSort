<script setup lang="ts">
import { ref, watch } from 'vue';
import { useSortStore } from '@/stores/sortStore';
import type { SortAlgorithm } from '@/types/sorting';

const store = useSortStore();

const algorithms: { value: SortAlgorithm; label: string }[] = [
  { value: 'merge', label: '归并' },
  { value: 'quick', label: '快速' },
  { value: 'bubble', label: '冒泡' },
  { value: 'insertion', label: '插入' },
  { value: 'shell', label: '希尔' }
];

const sliderValue = ref(store.animationSpeed);

watch(sliderValue, val => {
  store.setSpeed(val);
});

function handleAlgorithmChange(val: SortAlgorithm) {
  store.setAlgorithm(val);
}

function handleSizeChange(val: number) {
  store.arraySize = val;
  store.generateArray(val);
}

function handleNewArray() {
  store.generateArray(store.arraySize);
}
</script>

<template>
  <div class="control-panel">
    <div class="panel-section algo-section">
      <span class="section-label">算法</span>
      <div class="algo-tabs">
        <button v-for="alg in algorithms" :key="alg.value" class="algo-tab" :class="{ active: store.algorithm === alg.value }" @click="handleAlgorithmChange(alg.value)">
          {{ alg.label }}
        </button>
      </div>
    </div>

    <div class="panel-divider"></div>

    <div class="panel-section size-section">
      <span class="section-label">数据量</span>
      <div class="size-control">
        <input type="range" :value="store.arraySize" @input="e => handleSizeChange(Number((e.target as HTMLInputElement).value))" min="10" max="50" step="1" class="size-slider" />
        <span class="size-value">{{ store.arraySize }}</span>
      </div>
    </div>

    <div class="panel-divider"></div>

    <div class="panel-section speed-section">
      <span class="section-label">速度</span>
      <div class="speed-control">
        <input type="range" v-model="sliderValue" min="50" max="500" step="10" class="speed-slider" />
        <span class="speed-value">{{ sliderValue }}ms</span>
      </div>
      <div class="speed-marks">
        <span>快</span>
        <span>中</span>
        <span>慢</span>
      </div>
    </div>

    <div class="panel-divider"></div>

    <div class="panel-section action-section">
      <button class="action-btn" @click="handleNewArray">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M23 4v6h-6M1 20v-6h6" />
          <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
        </svg>
        新数组
      </button>
    </div>
  </div>
</template>

<style scoped>
.control-panel {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 16px 24px;
  background: rgba(10, 10, 20, 0.9);
  border: 1px solid rgba(74, 158, 255, 0.2);
  border-radius: 12px;
  backdrop-filter: blur(20px);
}

.panel-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: #8b95a8;
  letter-spacing: 1px;
}

/* Algorithm tabs */
.algo-tabs {
  display: flex;
  gap: 4px;
}

.algo-tab {
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  padding: 10px 16px;
  border: 1px solid rgba(74, 158, 255, 0.25);
  background: rgba(74, 158, 255, 0.08);
  color: #b4bcc8;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.algo-tab:hover {
  background: rgba(74, 158, 255, 0.1);
  color: #e0e0e0;
}

.algo-tab.active {
  background: rgba(74, 158, 255, 0.25);
  border-color: rgba(74, 158, 255, 0.6);
  color: #6bb3ff;
  box-shadow: 0 0 20px rgba(74, 158, 255, 0.3);
}

/* Dividers */
.panel-divider {
  width: 1px;
  height: 50px;
  background: linear-gradient(180deg, transparent, rgba(74, 158, 255, 0.3) 30%, rgba(74, 158, 255, 0.3) 70%, transparent);
  margin: 0 24px;
}

/* Size control */
.size-control,
.speed-control {
  display: flex;
  align-items: center;
  gap: 12px;
}

.size-slider,
.speed-slider {
  -webkit-appearance: none;
  width: 120px;
  height: 4px;
  background: rgba(74, 158, 255, 0.2);
  border-radius: 2px;
  outline: none;
}

.size-slider::-webkit-slider-thumb,
.speed-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  background: #4a9eff;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 0 10px rgba(74, 158, 255, 0.5);
  transition: transform 0.15s ease;
}

.size-slider::-webkit-slider-thumb:hover,
.speed-slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.size-value,
.speed-value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  color: #5dddd4;
  min-width: 55px;
}

.speed-marks {
  display: flex;
  justify-content: space-between;
  width: 120px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: #8b95a8;
}

/* Action button */
.action-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  padding: 10px 18px;
  border: 1px solid rgba(78, 205, 196, 0.4);
  background: rgba(78, 205, 196, 0.1);
  color: #4ecdc4;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: rgba(78, 205, 196, 0.2);
  border-color: rgba(78, 205, 196, 0.6);
  box-shadow: 0 0 20px rgba(78, 205, 196, 0.2);
  transform: translateY(-1px);
}

.icon {
  width: 16px;
  height: 16px;
}

@media (max-width: 900px) {
  .control-panel {
    flex-wrap: wrap;
    gap: 16px;
    padding: 16px;
  }

  .panel-divider {
    display: none;
  }

  .size-slider,
  .speed-slider {
    width: 100px;
  }

  .speed-marks {
    width: 100px;
  }
}
</style>
