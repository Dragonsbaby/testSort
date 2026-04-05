<script setup lang="ts">
import { onMounted } from "vue";
import { useSortStore } from "@/stores/sortStore";
import { algorithmInfo } from "@/types/sorting";
import SortVisualizer from "@/components/SortVisualizer.vue";
import ControlPanel from "@/components/ControlPanel.vue";

const store = useSortStore();

onMounted(() => {
  store.generateArray(store.arraySize);
});
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
    </main>
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
}
</style>