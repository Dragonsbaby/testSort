<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useSortStore } from '@/stores/sortStore';
import type { SortAlgorithm } from '@/types/sorting';
import { algorithmInfo } from '@/types/sorting';
import { getCompareMaxArraySize } from '@/composables/useCompareUtils';

const store = useSortStore();

const algorithms = Object.entries(algorithmInfo).map(([value, info]) => ({
  value: value as SortAlgorithm,
  label: (value === 'bucket' || value === 'heap') ? info.name : info.name.replace('排序', ''),
}));

const sliderValue = ref(store.animationSpeed);

watch(sliderValue, val => {
  store.setSpeed(Number(val));
});

function handleAlgorithmChange(val: SortAlgorithm) {
  store.setAlgorithm(val);
}

function handleSizeChange(val: number) {
  store.setArraySize(val);
}

function handleNewArray() {
  store.generateArray(store.arraySize);
}

const isCompareMode = computed(() => store.viewMode === 'compare');

const compareMaxSize = computed(() =>
  getCompareMaxArraySize(store.leftAlgorithm, store.rightAlgorithm)
);

function enterCompare() {
  store.enterCompareMode();
}

function exitCompare() {
  store.exitCompareMode();
}
</script>

<template>
  <div class="control-panel">
    <!-- 算法选择：对比模式下隐藏 -->
    <div v-if="!isCompareMode" class="panel-section algo-section">
      <select :value="store.algorithm" @change="e => handleAlgorithmChange((e.target as HTMLSelectElement).value as SortAlgorithm)" class="algo-dropdown" aria-label="选择排序算法">
        <option v-for="alg in algorithms" :key="alg.value" :value="alg.value">{{ alg.label }}</option>
      </select>
    </div>

    <!-- 算法信息：单算法模式显示 -->
    <div v-if="!isCompareMode" class="panel-section algo-info-section">
      <div class="algo-info">
        <span class="algo-complexity">{{ algorithmInfo[store.algorithm].complexity }}</span>
        <span class="algo-desc">{{ algorithmInfo[store.algorithm].description }}</span>
      </div>
    </div>

    <!-- 对比模式标签 -->
    <div v-if="isCompareMode" class="panel-section compare-badge-section">
      <span class="compare-badge">对比模式</span>
    </div>

    <div class="panel-divider"></div>

    <div class="panel-section size-section">
      <div class="size-control">
        <input type="range" :value="store.arraySize" @input="e => handleSizeChange(Number((e.target as HTMLInputElement).value))" min="10" :max="isCompareMode ? compareMaxSize : 100" step="1" class="size-slider" aria-label="数组大小" />
        <span class="size-value">{{ store.arraySize }}</span>
      </div>
    </div>

    <div class="panel-divider"></div>

    <div class="panel-section speed-section">
      <div class="speed-control">
        <input type="range" v-model="sliderValue" min="20" max="500" step="10" class="speed-slider" aria-label="动画速度" />
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

    <div class="panel-divider"></div>

    <div class="panel-section action-section">
      <button v-if="!isCompareMode" class="action-btn compare-enter-btn" @click="enterCompare">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="7" height="18" rx="2" />
          <rect x="14" y="3" width="7" height="18" rx="2" />
        </svg>
        对比模式
      </button>
      <button v-else class="action-btn compare-exit-btn" @click="exitCompare">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
        退出对比
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
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--panel-shadow);
}

.panel-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 2px 6px;
}

/* Algorithm selector */
.algo-dropdown {
  font-family: var(--font-mono);
  font-size: 13px;
  padding: 8px 32px 8px 12px;
  border: 1px solid var(--border);
  background: var(--bg-3);
  color: var(--text);
  border-radius: 6px;
  cursor: pointer;
  outline: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238b95a8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  min-width: 88px;
  transition: border-color 0.2s ease, background-color 0.2s ease;
}

.algo-dropdown:hover,
.algo-dropdown:focus {
  border-color: var(--accent);
}

.algo-dropdown option {
  background: var(--bg-3);
  color: var(--text);
}

/* Algorithm info */
.algo-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 260px;
}

.algo-complexity {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-secondary);
  padding: 2px 8px;
  background: transparent;
  border-radius: 4px;
  border: 1px solid var(--border);
  white-space: nowrap;
  font-weight: 600;
}

.algo-desc {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.4;
}

/* Dividers */
.panel-divider {
  width: 1px;
  height: 44px;
  background: var(--border);
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
  background: var(--bg-3);
  border: 1px solid var(--border);
  border-radius: 2px;
  outline: none;
  transition: background 0.2s ease;
}

.size-slider:hover,
.speed-slider:hover {
  background: var(--border);
}

.size-slider::-webkit-slider-thumb,
.speed-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  background: var(--accent);
  border-radius: 50%;
  cursor: pointer;
  box-shadow: none;
  transition: transform 0.15s ease;
}

.size-slider::-webkit-slider-thumb:hover,
.speed-slider::-webkit-slider-thumb:hover {
  transform: scale(1.15);
}

.size-value,
.speed-value {
  font-family: var(--font-mono);
  font-size: 14px;
  color: var(--text-secondary);
  min-width: 55px;
}

.speed-marks {
  display: flex;
  justify-content: space-between;
  width: 110px;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-muted);
  margin-top: 2px;
}

/* Action button */
.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-mono);
  font-size: 12px;
  padding: 8px 16px;
  border: 1px solid var(--border);
  background: var(--bg-3);
  color: var(--accent);
  border-radius: 6px;
  cursor: pointer;
  transition: border-color 0.2s ease, background-color 0.2s ease, transform 0.2s ease;
}

.action-btn:hover {
  border-color: var(--accent);
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

/* 对比模式：enter 与 .action-btn 同构（继承其样式）；exit 走 swapping 语义色 */
.compare-badge {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--accent);
  padding: 4px 12px;
  background: var(--bg-3);
  border: 1px solid var(--border);
  border-radius: 5px;
  white-space: nowrap;
}

.compare-exit-btn {
  color: var(--swapping);
  border-color: var(--swapping);
}
</style>
