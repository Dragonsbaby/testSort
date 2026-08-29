<template>
  <button
    class="theme-switch"
    :class="{ 'is-light': !themeStore.isDark }"
    :title="themeStore.isDark ? '切换到亮色画室' : '切换到暗色画廊'"
    :aria-label="themeStore.isDark ? '切换到亮色主题' : '切换到暗色主题'"
    @click="themeStore.toggleDarkMode()"
  >
    <!-- 太阳与月亮双图标，旋转+缩放过渡（暗色显月亮，亮色显太阳）；SVG 取自 @element-plus/icons-vue 原 path -->
    <span class="switch-icon icon-moon">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><path fill="currentColor" d="M240.448 240.448a384 384 0 1 0 559.424 525.696 448 448 0 0 1-542.016-542.08 391 391 0 0 0-17.408 16.384m181.056 362.048a384 384 0 0 0 525.632 16.384A448 448 0 1 1 405.056 76.8a384 384 0 0 0 16.448 525.696" /></svg>
    </span>
    <span class="switch-icon icon-sun">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><path fill="currentColor" d="M512 704a192 192 0 1 0 0-384 192 192 0 0 0 0 384m0 64a256 256 0 1 1 0-512 256 256 0 0 1 0 512m0-704a32 32 0 0 1 32 32v64a32 32 0 0 1-64 0V96a32 32 0 0 1 32-32m0 768a32 32 0 0 1 32 32v64a32 32 0 1 1-64 0v-64a32 32 0 0 1 32-32M195.2 195.2a32 32 0 0 1 45.248 0l45.248 45.248a32 32 0 1 1-45.248 45.248L195.2 240.448a32 32 0 0 1 0-45.248m543.104 543.104a32 32 0 0 1 45.248 0l45.248 45.248a32 32 0 1 1-45.248 45.248l-45.248-45.248a32 32 0 0 1 0-45.248M64 512a32 32 0 0 1 32-32h64a32 32 0 0 1 0 64H96a32 32 0 0 1-32-32m768 0a32 32 0 0 1 32-32h64a32 32 0 1 1 0 64h-64a32 32 0 0 1-32-32M195.2 828.8a32 32 0 0 1 0-45.248l45.248-45.248a32 32 0 0 1 45.248 45.248L240.448 828.8a32 32 0 0 1-45.248 0m543.104-543.104a32 32 0 0 1 0-45.248l45.248-45.248a32 32 0 0 1 45.248 45.248l-45.248 45.248a32 32 0 0 1-45.248 0" /></svg>
    </span>
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
