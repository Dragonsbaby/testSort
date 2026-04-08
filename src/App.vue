<script setup lang="ts">
import { onMounted } from "vue";
import { useSortStore } from "@/stores/sortStore";
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
      <ControlPanel />
    </header>

    <main class="main">
      <SortVisualizer />
    </main>

  </div>
</template>

<style lang="scss" scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 20px 24px 24px;
  max-width: 1600px;
  margin: 0 auto;
  position: relative;
  overflow: hidden;
}

/* Background grid pattern */
.bg-grid {
  position: fixed;
  inset: 0;
  // background-image:
  //   linear-gradient(rgba(74, 158, 255, 0.03) 1px, transparent 1px),
  //   linear-gradient(90deg, rgba(74, 158, 255, 0.03) 1px, transparent 1px);
  // background-size: 40px 40px;
  pointer-events: none;
  z-index: 0;
}

/* Header */
.header {
  position: relative;
  z-index: 1;
  margin-bottom: 20px;
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
    padding: 12px 16px 20px;
  }
}
</style>