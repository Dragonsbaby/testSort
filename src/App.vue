<script setup lang="ts">
import { onMounted } from "vue";
import { useSortStore } from "@/stores/sortStore";
import SortVisualizer from "@/components/SortVisualizer.vue";
import ControlPanel from "@/components/ControlPanel.vue";
import ThemeSwitcher from "@/components/ThemeSwitcher.vue";
import KeyboardShortcutsHelp from "@/components/KeyboardShortcutsHelp.vue";
import { useThemeKeyboardShortcuts } from "@/composables/useKeyboardShortcuts";

const store = useSortStore();

// 主题快捷键（双城时代仅剩 Alt+D）
useThemeKeyboardShortcuts();

onMounted(() => {
  store.generateArray(store.arraySize);
});
</script>

<template>
  <div class="app">
    <!-- 点阵背景：与 Canvas gridSpacing 24 对齐，颜色走 --canvas-grid -->
    <div class="bg-grid" aria-hidden="true"></div>
    <header class="header">
      <div class="header-content">
        <div class="app-title-group">
          <span class="app-eyebrow">SORTING&nbsp;VISUALIZER</span>
          <h1 class="app-title">排序算法可视化</h1>
        </div>
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
  background: var(--bg-1); /* 页面底色走 token（themeStore 注入） */
}

/* 点阵背景（画廊底纹） */
.bg-grid {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background-image: radial-gradient(var(--canvas-grid) 1px, transparent 1px);
  background-size: 24px 24px;
}

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

.app-title-group {
  margin: 0 0 14px 0;
  display: flex;
  align-items: baseline;
  gap: 10px;
}

/* 等宽小写 eyebrow 标签（作品感排版） */
.app-eyebrow {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.18em;
  color: var(--text-muted);
  text-transform: uppercase;
}

.app-title {
  margin: 0;
  font-size: 22px;
  font-weight: 650;
  letter-spacing: 0.01em;
  color: var(--text);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

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
    font-size: 19px;
  }
}
</style>
