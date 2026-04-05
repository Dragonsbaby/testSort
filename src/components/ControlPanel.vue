<script setup lang="ts">
import { ref, watch } from "vue";
import { useSortStore } from "@/stores/sortStore";
import type { SortAlgorithm } from "@/types/sorting";

const store = useSortStore();

const algorithms: { value: SortAlgorithm; label: string }[] = [
  { value: "merge", label: "归并排序" },
  { value: "quick", label: "快速排序" },
  { value: "bubble", label: "冒泡排序" },
  { value: "insertion", label: "插入排序" },
];

const sliderValue = ref(200);

watch(sliderValue, (val) => {
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
    <div class="control-row">
      <div class="control-group">
        <label class="control-label">算法</label>
        <el-select
          :model-value="store.algorithm"
          @change="handleAlgorithmChange"
          placeholder="选择算法"
          class="algorithm-select"
        >
          <el-option
            v-for="alg in algorithms"
            :key="alg.value"
            :label="alg.label"
            :value="alg.value"
          />
        </el-select>
      </div>

      <div class="control-group">
        <label class="control-label">数组大小</label>
        <el-slider
          v-model="store.arraySize"
          :min="10"
          :max="50"
          :step="1"
          show-input
          input-size="small"
          @change="handleSizeChange"
          class="size-slider"
        />
      </div>

      <div class="control-group">
        <label class="control-label">速度 (ms)</label>
        <el-slider
          v-model="sliderValue"
          :min="50"
          :max="500"
          :step="10"
          :marks="{ 50: '快', 275: '中', 500: '慢' }"
          class="speed-slider"
        />
      </div>
    </div>

    <div class="control-row buttons">
      <el-button
        icon="Refresh"
        @click="handleNewArray"
        size="large"
        class="control-btn"
      >
        新数组
      </el-button>
    </div>
  </div>
</template>

<style scoped>
.control-panel {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 20px;
  backdrop-filter: blur(10px);
}

.control-row {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  align-items: flex-end;
}

.control-row.buttons {
  margin-top: 20px;
  justify-content: center;
  gap: 16px;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-width: 180px;
}

.control-label {
  font-family: "JetBrains Mono", monospace;
  font-size: 12px;
  color: #8892b0;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.algorithm-select {
  width: 100%;
}

:deep(.el-select) {
  --el-fill-color-blank: rgba(255, 255, 255, 0.1);
  --el-text-color-regular: #e0e0e0;
}

:deep(.el-slider__runway) {
  background-color: rgba(255, 255, 255, 0.1);
}

:deep(.el-slider__bar) {
  background-color: #4a9eff;
}

:deep(.el-slider__button) {
  border-color: #4a9eff;
}

:deep(.el-input__wrapper) {
  background-color: rgba(255, 255, 255, 0.1);
}

:deep(.el-button) {
  font-family: "JetBrains Mono", monospace;
}

.control-btn {
  min-width: 100px;
  transition: all 0.2s ease;
}

.control-btn:hover {
  transform: translateY(-2px);
}

.size-slider {
  width: 100%;
}

.speed-slider {
  width: 100%;
}

@media (max-width: 768px) {
  .control-row {
    flex-direction: column;
    align-items: stretch;
  }

  .control-row.buttons {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .control-btn {
    flex: 1;
    min-width: 80px;
  }
}
</style>