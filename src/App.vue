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
    <!-- Background grid pattern -->
    <div class="bg-grid"></div>

    <header class="header">
      <div class="title-row">
        <h1 class="title">test<span class="accent">Sort</span></h1>
        <div class="version">v1.0</div>
      </div>
      <div class="algo-hud" v-if="store.algorithm">
        <div class="hud-item">
          <span class="hud-label">算法</span>
          <span class="hud-value algo-name">{{ algorithmInfo[store.algorithm].name }}</span>
        </div>
        <div class="hud-divider"></div>
        <div class="hud-item">
          <span class="hud-label">复杂度</span>
          <span class="hud-value complexity">{{ algorithmInfo[store.algorithm].complexity }}</span>
        </div>
        <div class="hud-divider"></div>
        <div class="hud-item wide">
          <span class="hud-label">描述</span>
          <span class="hud-value desc">{{ algorithmInfo[store.algorithm].description }}</span>
        </div>
      </div>
      <ControlPanel />
    </header>

    <main class="main">
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
  max-width: 1600px;
  margin: 0 auto;
  position: relative;
  overflow: hidden;
}

/* Background grid pattern */
.bg-grid {
  position: fixed;
  inset: 0;
  background-image:
    linear-gradient(rgba(74, 158, 255, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(74, 158, 255, 0.03) 1px, transparent 1px);
  background-size: 40px 40px;
  pointer-events: none;
  z-index: 0;
}

/* Header */
.header {
  text-align: center;
  margin-bottom: 20px;
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.title-row {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 12px;
  margin-bottom: 16px;
}

.title {
  font-family: "JetBrains Mono", monospace;
  font-size: 42px;
  font-weight: 800;
  color: #e0e0e0;
  margin: 0;
  letter-spacing: -1px;
  text-shadow: 0 0 30px rgba(74, 158, 255, 0.3);
}

.title .accent {
  color: #4a9eff;
  text-shadow: 0 0 20px rgba(74, 158, 255, 0.6);
}

.version {
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  color: #4a9eff;
  background: rgba(74, 158, 255, 0.1);
  padding: 3px 8px;
  border-radius: 4px;
  border: 1px solid rgba(74, 158, 255, 0.2);
}

/* HUD bar */
.algo-hud {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 12px 24px;
  background: rgba(10, 10, 20, 0.8);
  border: 1px solid rgba(74, 158, 255, 0.15);
  border-radius: 8px;
  max-width: 900px;
  margin: 0 auto;
  backdrop-filter: blur(10px);
}

.hud-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.hud-item.wide {
  min-width: 200px;
  text-align: center;
}

.hud-label {
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  color: #8b95a8;
  letter-spacing: 1px;
}

.hud-value {
  font-family: "JetBrains Mono", monospace;
  font-size: 14px;
  color: #5dddd4;
}

.hud-value.algo-name {
  color: #6bb3ff;
  font-weight: 600;
}

.hud-value.complexity {
  color: #ff8a8a;
  font-weight: 600;
}

.hud-value.desc {
  color: #a8b2c8;
  font-size: 12px;
  text-transform: none;
}

.hud-divider {
  width: 1px;
  height: 30px;
  background: linear-gradient(
    180deg,
    transparent,
    rgba(74, 158, 255, 0.3) 50%,
    transparent
  );
}

/* Main content */
.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: relative;
  z-index: 1;
}

@media (max-width: 768px) {
  .app {
    padding: 16px;
  }

  .title {
    font-size: 28px;
  }

  .algo-hud {
    flex-direction: column;
    gap: 12px;
    padding: 16px;
  }

  .hud-divider {
    width: 100%;
    height: 1px;
  }

  .hud-item.wide {
    min-width: auto;
    width: 100%;
  }
}
</style>