<template>
  <div class="theme-switcher">
    <!-- 快捷切换按钮 -->
    <button
      class="theme-toggle"
      @click="toggleThemeSelector"
      :title="`当前主题: ${currentTheme.name}`"
    >
      <span class="theme-icon">{{ getThemeIcon(currentThemeId) }}</span>
      <span class="theme-name-short">{{ getShortName(currentTheme.name) }}</span>
    </button>

    <!-- 主题选择器弹窗 -->
    <transition name="modal">
      <div v-if="showSelector" class="theme-modal" @click.self="closeSelector">
        <div class="theme-modal-content">
          <ThemeSelector @close="closeSelector" />
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useThemeStore } from '@/stores/themeStore';
import ThemeSelector from './ThemeSelector.vue';
import type { ThemeId } from '@/types/theme';

// Store
const themeStore = useThemeStore();

// 状态
const showSelector = ref(false);

// 计算属性
const currentThemeId = computed(() => themeStore.currentThemeId);
const currentTheme = computed(() => themeStore.currentTheme);

// 方法
function toggleThemeSelector() {
  showSelector.value = !showSelector.value;
}

function closeSelector() {
  showSelector.value = false;
}

function getThemeIcon(themeId: ThemeId): string {
  const iconMap: Record<ThemeId, string> = {
    dark: '🌙',
    light: '🌞',
    cyberpunk: '🌆',
    ocean: '🌊',
    sunset: '🌅',
    forest: '🌲',
  };
  return iconMap[themeId] || '🎨';
}

function getShortName(name: string): string {
  return name.substring(0, 2);
}

// 键盘快捷键：仅保留 Escape 关闭弹窗（Alt+T 全局切换主题已在 App.vue 的 useThemeKeyboardShortcuts 注册）
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closeSelector();
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<style scoped>
.theme-switcher {
  position: relative;
  display: inline-block;
}

.theme-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: var(--color-text, #ffffff);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.theme-toggle:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--color-primary, #4a9eff);
  transform: translateY(-1px);
}

.theme-toggle:active {
  transform: translateY(0);
}

.theme-icon {
  font-size: 18px;
  line-height: 1;
}

.theme-name-short {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

/* 模态框样式 */
.theme-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.theme-modal-content {
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* 模态框过渡动画 */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .theme-modal-content,
.modal-leave-active .theme-modal-content {
  transition: transform 0.3s ease;
}

.modal-enter-from .theme-modal-content,
.modal-leave-to .theme-modal-content {
  transform: translateY(20px);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .theme-modal-content {
    margin: 16px;
    max-width: calc(100vw - 32px);
  }
}
</style>
