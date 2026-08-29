<template>
  <div class="keyboard-shortcuts-help">
    <button
      class="help-button"
      @click="showHelp = !showHelp"
      :title="showHelp ? '隐藏快捷键' : '显示快捷键'"
    >
      ⌨️ 快捷键
    </button>

    <transition name="fade">
      <div v-if="showHelp" class="help-panel" @click.self="showHelp = false">
        <div class="help-content">
          <div class="help-header">
            <h3>⌨️ 键盘快捷键</h3>
            <button class="close-btn" @click="showHelp = false">✕</button>
          </div>

          <div class="help-sections">
            <!-- 主题快捷键 -->
            <div class="help-section">
              <h4>🌓 主题</h4>
              <div class="shortcut-list">
                <div class="shortcut-item">
                  <kbd>Alt</kbd> + <kbd>D</kbd>
                  <span>切换深色/浅色主题</span>
                </div>
              </div>
            </div>

            <!-- 播放控制快捷键 -->
            <div class="help-section">
              <h4>▶️ 播放控制</h4>
              <div class="shortcut-list">
                <div class="shortcut-item">
                  <kbd>Space</kbd>
                  <span>播放/暂停</span>
                </div>
                <div class="shortcut-item">
                  <kbd>Home</kbd>
                  <span>停止并回到开头</span>
                </div>
                <div class="shortcut-item">
                  <kbd>→</kbd> / <kbd>↓</kbd>
                  <span>单步前进</span>
                </div>
                <div class="shortcut-item">
                  <kbd>←</kbd> / <kbd>↑</kbd>
                  <span>单步后退</span>
                </div>
              </div>
            </div>
          </div>

          <div class="help-footer">
            <p>💡 提示：在输入框中快捷键不会生效</p>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const showHelp = ref(false);
</script>

<style scoped>
.keyboard-shortcuts-help {
  position: relative;
  display: inline-block;
}

.help-button {
  padding: 8px 16px;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
}

.help-button:hover {
  border-color: var(--accent);
  color: var(--text);
}

.help-panel {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
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

.help-content {
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: var(--panel-shadow);
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

.help-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}

.help-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text);
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 24px;
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  transition: color 0.2s;
}

.close-btn:hover {
  color: var(--text);
}

.help-sections {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.help-section {
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px;
}

.help-section h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.shortcut-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.shortcut-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.shortcut-item kbd {
  background: var(--bg-3);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 4px 8px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  white-space: nowrap;
}

.shortcut-item span {
  color: var(--text-muted);
  flex: 1;
}

.help-footer {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
  text-align: center;
}

.help-footer p {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
}

/* 过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .help-content {
    margin: 16px;
    max-width: calc(100vw - 32px);
  }

  .shortcut-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .shortcut-item span {
    align-self: flex-end;
  }
}
</style>