<script setup lang="ts">
import { onMounted } from "vue";
import { useSortStore } from "@/stores/sortStore";
import { useTheme } from "@/composables/useTheme";
import { useThemeKeyboardShortcuts } from "@/composables/useKeyboardShortcuts";
import SortVisualizer from "@/components/SortVisualizer.vue";
import ControlPanel from "@/components/ControlPanel.vue";
import ThemeSwitcher from "@/components/ThemeSwitcher.vue";
import KeyboardShortcutsHelp from "@/components/KeyboardShortcutsHelp.vue";

const store = useSortStore();
const theme = useTheme();

// 启用主题键盘快捷键
useThemeKeyboardShortcuts();

// 生成动态网格背景样式
function getBackgroundGridStyle() {
  const gridColor = theme.getGridColor();
  const gridSize = theme.themeEffects.value.gridSpacing;

  return {
    backgroundImage: `
      linear-gradient(${gridColor} 1px, transparent 1px),
      linear-gradient(90deg, ${gridColor} 1px, transparent 1px)
    `,
    backgroundSize: `${gridSize}px ${gridSize}px`,
    backgroundPosition: '-1px -1px',
  };
}

onMounted(() => {
  store.generateArray(store.arraySize);
});
</script>

<template>
  <div class="app" :style="{ backgroundColor: theme.getBackgroundColor() }">
    <div class="bg-grid" :style="getBackgroundGridStyle()"></div>
    <header class="header">
      <div class="header-content">
        <h1 class="app-title" :style="{ color: theme.themeColors.value.text }">
          排序算法可视化
        </h1>
        <ControlPanel />
      </div>
      <div class="header-actions">
        <ThemeSwitcher />
        <KeyboardShortcutsHelp />
      </div>
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
  overflow: visible;
  transition: background-color 0.3s ease;
}

/* Background grid pattern */
.bg-grid {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  transition: background-image 0.3s ease, background-size 0.3s ease;
  opacity: 0.6;
}

/* Header */
.header {
  position: relative;
  z-index: 1;
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.header-content {
  flex: 1;
}

.app-title {
  margin: 0 0 16px 0;
  font-size: 24px;
  font-weight: 600;
  transition: color 0.3s ease;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* Main content */
.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: relative;
  z-index: 0;
}

@media (max-width: 768px) {
  .app {
    padding: 12px 16px 20px;
  }

  .header {
    flex-direction: column;
  }

  .app-title {
    font-size: 20px;
  }
}
</style>