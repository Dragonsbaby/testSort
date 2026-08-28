<template>
  <button
    class="theme-switch"
    :class="{ 'is-light': !themeStore.isDark }"
    :title="themeStore.isDark ? '切换到亮色画室' : '切换到暗色画廊'"
    :aria-label="themeStore.isDark ? '切换到亮色主题' : '切换到暗色主题'"
    @click="themeStore.toggleDarkMode()"
  >
    <!-- 太阳与月亮双图标，旋转+缩放过渡（暗色显月亮，亮色显太阳） -->
    <span class="switch-icon icon-moon"><Moon /></span>
    <span class="switch-icon icon-sun"><Sunny /></span>
  </button>
</template>

<script setup lang="ts">
import { useThemeStore } from '@/stores/themeStore';

const themeStore = useThemeStore();
</script>

<style lang="scss" scoped>
.theme-switch {
  position: relative;
  width: 38px;
  height: 38px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg-2);
  cursor: pointer;
  overflow: hidden;
  transition: background-color 0.3s ease, border-color 0.3s ease;
  flex-shrink: 0;
}

.theme-switch:hover {
  border-color: var(--accent);
}

.switch-icon {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  color: var(--text-secondary);
  transition: transform 0.45s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
}

/* 暗色（默认）：月亮在位，太阳旋出隐没 */
.icon-sun {
  transform: rotate(90deg) scale(0.4);
  opacity: 0;
}

/* 亮色：太阳转正显现，月亮旋出 */
.theme-switch.is-light .icon-sun {
  transform: rotate(0deg) scale(1);
  opacity: 1;
  color: var(--accent);
}

.theme-switch.is-light .icon-moon {
  transform: rotate(-90deg) scale(0.4);
  opacity: 0;
}
</style>
