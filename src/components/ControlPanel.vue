<script setup lang="ts">
import { ref, watch } from 'vue';
import { useSortStore } from '@/stores/sortStore';
import type { SortAlgorithm } from '@/types/sorting';
import { algorithmInfo } from '@/types/sorting';

const store = useSortStore();

const algorithms = Object.entries(algorithmInfo).map(([value, info]) => ({
  value: value as SortAlgorithm,
  label: (value === 'bucket' || value === 'heap') ? info.name : info.name.replace('排序', ''),
}));

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
      <select :value="store.algorithm" @change="e => handleAlgorithmChange((e.target as HTMLSelectElement).value as SortAlgorithm)" class="algo-dropdown">
        <option v-for="alg in algorithms" :key="alg.value" :value="alg.value">{{ alg.label }}</option>
      </select>
    </div>

    <div class="panel-section algo-info-section">
      <div class="algo-info">
        <span class="algo-complexity">{{ algorithmInfo[store.algorithm].complexity }}</span>
        <span class="algo-desc">{{ algorithmInfo[store.algorithm].description }}</span>
      </div>
    </div>

    <div class="panel-divider"></div>

    <div class="panel-section size-section">
      <div class="size-control">
        <input type="range" :value="store.arraySize" @input="e => handleSizeChange(Number((e.target as HTMLInputElement).value))" min="10" max="100" step="1" class="size-slider" />
        <span class="size-value">{{ store.arraySize }}</span>
      </div>
    </div>

    <div class="panel-divider"></div>

    <div class="panel-section speed-section">
      <div class="speed-control">
        <input type="range" v-model="sliderValue" min="20" max="500" step="10" class="speed-slider" />
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

<style lang="scss" scoped>
.control-panel {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 14px 28px;
  background: rgba(10, 10, 20, 0.85);
  border: 1px solid rgba(74, 158, 255, 0.15);
  border-radius: 14px;
  backdrop-filter: blur(20px);
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

.panel-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 2px 6px;
}

/* Algorithm selector */
.algo-dropdown {
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  padding: 8px 32px 8px 12px;
  border: 1px solid rgba(74, 158, 255, 0.25);
  background: rgba(74, 158, 255, 0.08);
  color: #6bb3ff;
  border-radius: 6px;
  cursor: pointer;
  outline: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238b95a8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  min-width: 88px;
  transition: all 0.2s ease;
}

.algo-dropdown:hover {
  background-color: rgba(74, 158, 255, 0.12);
  border-color: rgba(74, 158, 255, 0.4);
}

.algo-dropdown:focus {
  border-color: rgba(74, 158, 255, 0.5);
  box-shadow: 0 0 0 3px rgba(74, 158, 255, 0.1);
}

.algo-dropdown option {
  background: #0d1117;
  color: #e0e0e0;
}

/* Algorithm info */
.algo-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 260px;
}

.algo-complexity {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: #4adeee;
  padding: 2px 8px;
  background: rgba(74, 222, 222, 0.08);
  border-radius: 4px;
  border: 1px solid rgba(74, 222, 222, 0.2);
  white-space: nowrap;
  font-weight: 600;
}

.algo-desc {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: #a8b2c8;
  line-height: 1.4;
}

/* Dividers */
.panel-divider {
  width: 1px;
  height: 44px;
  background: linear-gradient(180deg, transparent, rgba(74, 158, 255, 0.25) 30%, rgba(74, 158, 255, 0.25) 70%, transparent);
  margin: 0 20px;
}

/* Size control */
.size-control,
.speed-control {
  display: flex;
  align-items: center;
  gap: 10px;
}

.size-slider,
.speed-slider {
  -webkit-appearance: none;
  width: 110px;
  height: 4px;
  background: rgba(74, 158, 255, 0.15);
  border-radius: 2px;
  outline: none;
  transition: background 0.2s ease;
}

.size-slider:hover,
.speed-slider:hover {
  background: rgba(74, 158, 255, 0.25);
}

.size-slider::-webkit-slider-thumb,
.speed-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  background: #4a9eff;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 0 8px rgba(74, 158, 255, 0.4);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.size-slider::-webkit-slider-thumb:hover,
.speed-slider::-webkit-slider-thumb:hover {
  transform: scale(1.15);
  box-shadow: 0 0 14px rgba(74, 158, 255, 0.6);
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
  width: 110px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: #8b95a8;
  margin-top: 2px;
}

/* Action button */
.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  padding: 8px 16px;
  border: 1px solid rgba(78, 205, 196, 0.3);
  background: rgba(78, 205, 196, 0.08);
  color: #4ecdc4;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: rgba(78, 205, 196, 0.15);
  border-color: rgba(78, 205, 196, 0.5);
  box-shadow: 0 0 16px rgba(78, 205, 196, 0.15);
  transform: translateY(-1px);
}

.action-btn:active {
  transform: translateY(0);
}

.icon {
  width: 14px;
  height: 14px;
}

@media (max-width: 900px) {
  .control-panel {
    flex-wrap: wrap;
    gap: 12px;
    padding: 14px 16px;
    justify-content: center;
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

  .algo-info {
    align-items: flex-start;
  }
}
</style>
