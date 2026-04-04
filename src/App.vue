<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import { useSortStore } from "@/stores/sortStore";
import { algorithmInfo } from "@/types/sorting";
import SortVisualizer from "@/components/SortVisualizer.vue";
import ControlPanel from "@/components/ControlPanel.vue";

const store = useSortStore();

onMounted(() => {
  store.generateArray(store.arraySize);
  window.addEventListener("keydown", handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown);
});

function handleKeydown(e: KeyboardEvent) {
  if (e.code === "Space") {
    e.preventDefault();
    store.isPlaying ? store.pauseAnimation() : store.startSort();
  } else if (e.code === "KeyR") {
    store.stopAnimation();
  } else if (e.code === "KeyN") {
    store.generateArray(store.arraySize);
  }
}
</script>

<template>
  <div class="app">
    <header class="header">
      <div class="title-section">
        <h1 class="title">testSort</h1>
        <p class="subtitle">排序算法可视化</p>
      </div>
      <div class="algorithm-info" v-if="store.algorithm">
        <span class="info-name">{{ algorithmInfo[store.algorithm].name }}</span>
        <span class="info-desc">{{
          algorithmInfo[store.algorithm].description
        }}</span>
        <span class="info-complexity">{{
          algorithmInfo[store.algorithm].complexity
        }}</span>
      </div>
    </header>

    <main class="main">
      <ControlPanel />

      <SortVisualizer />

      <footer class="stats-bar">
        <div class="stat">
          <span class="stat-label">比较次数</span>
          <span class="stat-value">{{ store.comparisons }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">交换次数</span>
          <span class="stat-value">{{ store.swaps }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">当前步骤</span>
          <span class="stat-value"
            >{{ store.currentStep }} / {{ store.steps.length }}</span
          >
        </div>
        <div class="stat description" v-if="store.currentStepInfo">
          <span class="stat-label">操作</span>
          <span class="stat-value desc">{{
            store.currentStepInfo.description
          }}</span>
        </div>
      </footer>
    </main>

    <div class="shortcuts">
      <span><kbd>Space</kbd> 开始/暂停</span>
      <span><kbd>R</kbd> 重置</span>
      <span><kbd>N</kbd> 新数组</span>
    </div>
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

.header {
  text-align: center;
  margin-bottom: 32px;
}

.title-section {
  margin-bottom: 16px;
}

.title {
  font-family: "JetBrains Mono", monospace;
  font-size: 48px;
  font-weight: 800;
  color: #4a9eff;
  margin: 0;
  letter-spacing: -2px;
  text-shadow: 0 0 40px rgba(74, 158, 255, 0.3);
}

.subtitle {
  font-family: "JetBrains Mono", monospace;
  font-size: 14px;
  color: #8892b0;
  margin: 8px 0 0;
  letter-spacing: 2px;
}

.algorithm-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  flex-wrap: wrap;
  padding: 12px 24px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  max-width: 800px;
  margin: 0 auto;
}

.info-name {
  font-family: "JetBrains Mono", monospace;
  font-size: 16px;
  font-weight: 600;
  color: #4ecdc4;
}

.info-desc {
  font-family: "JetBrains Mono", monospace;
  font-size: 12px;
  color: #8892b0;
}

.info-complexity {
  font-family: "JetBrains Mono", monospace;
  font-size: 14px;
  font-weight: 600;
  color: #ff6b6b;
  background: rgba(255, 107, 107, 0.1);
  padding: 4px 12px;
  border-radius: 4px;
}

.main {
  display: flex;
  flex-direction: column;
  gap: 20px;
  flex: 1;
}

.stats-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  justify-content: center;
  padding: 16px 24px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 100px;
}

.stat-label {
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  color: #8892b0;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.stat-value {
  font-family: "JetBrains Mono", monospace;
  font-size: 20px;
  font-weight: 700;
  color: #e0e0e0;
  font-variant-numeric: tabular-nums;
}

.stat-value.desc {
  font-size: 13px;
  font-weight: 400;
  color: #ffcc00;
  max-width: 400px;
  text-align: center;
}

.stat.description {
  flex: 1;
  min-width: 200px;
}

.shortcuts {
  display: flex;
  justify-content: center;
  gap: 24px;
  margin-top: 20px;
  padding: 12px;
}

.shortcuts span {
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  color: #5a6a8a;
  display: flex;
  align-items: center;
  gap: 6px;
}

kbd {
  display: inline-block;
  padding: 3px 8px;
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  color: #8892b0;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}

@media (max-width: 768px) {
  .app {
    padding: 16px;
  }

  .title {
    font-size: 32px;
  }

  .algorithm-info {
    flex-direction: column;
    gap: 8px;
  }

  .shortcuts {
    flex-wrap: wrap;
    gap: 12px;
  }
}
</style>
