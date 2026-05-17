<template>
  <div class="theme-selector">
    <div class="theme-header">
      <h3>选择主题</h3>
      <button
        class="close-btn"
        @click="$emit('close')"
        aria-label="关闭主题选择器"
      >
        ✕
      </button>
    </div>

    <div class="theme-grid">
      <div
        v-for="theme in availableThemes"
        :key="theme.id"
        class="theme-card"
        :class="{
          'theme-card--active': theme.id === currentThemeId,
          'theme-card--transitioning': isTransitioning
        }"
        @click="selectTheme(theme.id)"
        :title="theme.description"
      >
        <!-- 主题预览 -->
        <div class="theme-preview">
          <div class="theme-preview-background" :style="{ background: theme.colors.background }">
            <!-- 预览柱子 -->
            <div class="preview-bars">
              <div
                v-for="(color, index) in getPreviewColors(theme)"
                :key="index"
                class="preview-bar"
                :style="{
                  background: color,
                  height: `${20 + index * 15}%`,
                  opacity: index === 2 ? 1 : 0.7
                }"
              ></div>
            </div>

            <!-- 预览网格 -->
            <div class="preview-grid" :style="{ background: theme.colors.grid }"></div>

            <!-- 预览基线 -->
            <div class="preview-baseline" :style="{ background: theme.colors.baseline }"></div>
          </div>
        </div>

        <!-- 主题信息 -->
        <div class="theme-info">
          <h4 class="theme-name">{{ theme.name }}</h4>
          <p class="theme-description">{{ theme.description }}</p>

          <!-- 主题标签 -->
          <div class="theme-tags">
            <span
              v-if="theme.id === 'dark'"
              class="theme-tag theme-tag--default"
            >
              默认
            </span>
            <span
              v-if="['dark', 'cyberpunk', 'ocean', 'sunset', 'forest'].includes(theme.id)"
              class="theme-tag theme-tag--dark"
            >
              深色
            </span>
            <span
              v-else
              class="theme-tag theme-tag--light"
            >
              浅色
            </span>
            <span
              v-if="theme.effects.particleEffect"
              class="theme-tag theme-tag--special"
            >
              特效
            </span>
          </div>
        </div>

        <!-- 选中指示器 -->
        <div v-if="theme.id === currentThemeId" class="theme-selected">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="9" fill="currentColor" />
            <path
              d="M6 10L8.5 12.5L14 7"
              stroke="white"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
      </div>
    </div>

    <!-- 快捷操作 -->
    <div class="theme-actions">
      <button class="theme-btn" @click="toggleDarkMode" title="切换深色/浅色模式">
        <span v-if="isCurrentDark">🌞 浅色模式</span>
        <span v-else>🌙 深色模式</span>
      </button>
      <button class="theme-btn" @click="resetTheme" title="重置为默认主题">
        🔄 重置
      </button>
      <button class="theme-btn" @click="randomTheme" title="随机主题">
        🎲 随机
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useThemeStore } from '@/stores/themeStore';
import type { ThemeId } from '@/types/theme';

// Props
defineProps<{
  show?: boolean;
}>();

// Emits
defineEmits<{
  close: [];
}>();

// Store
const themeStore = useThemeStore();

// 计算属性
const availableThemes = computed(() => themeStore.availableThemes);
const currentThemeId = computed(() => themeStore.currentThemeId);
const isTransitioning = computed(() => themeStore.isTransitioning);

// 判断当前是否为深色主题
const isCurrentDark = computed(() => {
  return ['dark', 'cyberpunk', 'ocean', 'sunset', 'forest'].includes(currentThemeId.value);
});

// 方法
function selectTheme(themeId: ThemeId) {
  themeStore.setTheme(themeId);
}

function toggleDarkMode() {
  themeStore.toggleDarkMode();
}

function resetTheme() {
  themeStore.resetToDefault();
}

function randomTheme() {
  const randomIndex = Math.floor(Math.random() * availableThemes.value.length);
  themeStore.setTheme(availableThemes.value[randomIndex].id);
}

// 获取预览颜色
function getPreviewColors(theme: typeof availableThemes.value[0]) {
  return [
    theme.colors.primary,
    theme.stateStyles.comparing?.fill || theme.colors.primary,
    theme.stateStyles.sorted?.fill || theme.colors.primary,
    theme.stateStyles.swapping?.fill || theme.colors.primary,
  ];
}
</script>

<style scoped>
.theme-selector {
  background: var(--color-background-secondary, #1a1a2e);
  border-radius: 12px;
  padding: 24px;
  min-width: 600px;
  max-width: 800px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.theme-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--color-divider, rgba(255, 255, 255, 0.1));
}

.theme-header h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text, #ffffff);
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--color-text-muted, rgba(255, 255, 255, 0.5));
  font-size: 24px;
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--color-text, #ffffff);
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.theme-card {
  position: relative;
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid transparent;
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.theme-card:hover {
  background: rgba(255, 255, 255, 0.08);
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
}

.theme-card--active {
  border-color: var(--color-primary, #4a9eff);
  background: rgba(74, 158, 255, 0.1);
}

.theme-card--transitioning {
  transition: opacity 0.3s ease;
}

.theme-preview {
  margin-bottom: 12px;
  border-radius: 8px;
  overflow: hidden;
  aspect-ratio: 16/9;
}

.theme-preview-background {
  position: relative;
  width: 100%;
  height: 100%;
  padding: 12px;
}

.preview-bars {
  display: flex;
  justify-content: center;
  align-items: flex-end;
  gap: 4px;
  height: 70%;
  margin-bottom: 8px;
}

.preview-bar {
  width: 12px;
  border-radius: 2px 2px 0 0;
  transition: all 0.2s;
}

.preview-grid {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  opacity: 0.3;
  pointer-events: none;
}

.preview-baseline {
  position: absolute;
  bottom: 20%;
  left: 0;
  right: 0;
  height: 1px;
  opacity: 0.6;
}

.theme-info {
  text-align: center;
}

.theme-name {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text, #ffffff);
}

.theme-description {
  margin: 0 0 8px 0;
  font-size: 12px;
  color: var(--color-text-muted, rgba(255, 255, 255, 0.5));
  line-height: 1.4;
}

.theme-tags {
  display: flex;
  gap: 4px;
  justify-content: center;
  flex-wrap: wrap;
}

.theme-tag {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
}

.theme-tag--default {
  background: var(--color-primary, #4a9eff);
  color: white;
}

.theme-tag--dark {
  background: rgba(255, 255, 255, 0.1);
  color: var(--color-text-muted, rgba(255, 255, 255, 0.7));
}

.theme-tag--light {
  background: rgba(0, 0, 0, 0.2);
  color: var(--color-text, #ffffff);
}

.theme-tag--special {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.theme-selected {
  position: absolute;
  top: 8px;
  right: 8px;
  color: var(--color-primary, #4a9eff);
  animation: scaleIn 0.3s ease;
}

@keyframes scaleIn {
  from {
    transform: scale(0);
  }
  to {
    transform: scale(1);
  }
}

.theme-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  padding-top: 16px;
  border-top: 1px solid var(--color-divider, rgba(255, 255, 255, 0.1));
}

.theme-btn {
  padding: 10px 20px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: var(--color-text, #ffffff);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.theme-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--color-primary, #4a9eff);
  transform: translateY(-1px);
}

.theme-btn:active {
  transform: translateY(0);
}

/* 主题切换过渡效果 */
body.theme-transitioning,
body.theme-transitioning * {
  transition-property: background-color, color, border-color, fill, stroke !important;
  transition-duration: 300ms !important;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1) !important;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .theme-selector {
    min-width: auto;
    max-width: none;
    margin: 16px;
  }

  .theme-grid {
    grid-template-columns: 1fr;
  }

  .theme-actions {
    flex-direction: column;
  }

  .theme-btn {
    width: 100%;
  }
}
</style>