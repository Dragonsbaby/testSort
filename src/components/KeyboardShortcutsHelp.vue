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
              <h4>🎨 主题快捷键</h4>
              <div class="shortcut-list">
                <div class="shortcut-item">
                  <kbd>Alt</kbd> + <kbd>T</kbd>
                  <span>下一个主题</span>
                </div>
                <div class="shortcut-item">
                  <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>T</kbd>
                  <span>上一个主题</span>
                </div>
                <div class="shortcut-item">
                  <kbd>Alt</kbd> + <kbd>D</kbd>
                  <span>切换深色/浅色</span>
                </div>
                <div class="shortcut-item">
                  <kbd>Alt</kbd> + <kbd>R</kbd>
                  <span>重置主题</span>
                </div>
              </div>
            </div>

            <!-- 快速主题切换 -->
            <div class="help-section">
              <h4>⚡ 快速主题切换</h4>
              <div class="shortcut-list">
                <div class="shortcut-item">
                  <kbd>Alt</kbd> + <kbd>1</kbd>
                  <span>🌙 深色经典</span>
                </div>
                <div class="shortcut-item">
                  <kbd>Alt</kbd> + <kbd>2</kbd>
                  <span>🌞 明亮清新</span>
                </div>
                <div class="shortcut-item">
                  <kbd>Alt</kbd> + <kbd>3</kbd>
                  <span>🌆 赛博朋克</span>
                </div>
                <div class="shortcut-item">
                  <kbd>Alt</kbd> + <kbd>4</kbd>
                  <span>🌊 深海探险</span>
                </div>
                <div class="shortcut-item">
                  <kbd>Alt</kbd> + <kbd>5</kbd>
                  <span>🌅 日落余晖</span>
                </div>
                <div class="shortcut-item">
                  <kbd>Alt</kbd> + <kbd>6</kbd>
                  <span>🌲 森林秘境</span>
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
                <div class="shortcut-item">
                  <kbd>PageDown</kbd>
                  <span>快速前进</span>
                </div>
                <div class="shortcut-item">
                  <kbd>PageUp</kbd>
                  <span>快速后退</span>
                </div>
                <div class="shortcut-item">
                  <kbd>End</kbd>
                  <span>跳转到最后</span>
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
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: var(--color-text, #ffffff);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.help-button:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--color-primary, #4a9eff);
  transform: translateY(-1px);
}

.help-panel {
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
  background: var(--color-background-secondary, #1a1a2e);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 24px;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
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
  border-bottom: 1px solid var(--color-divider, rgba(255, 255, 255, 0.1));
}

.help-header h3 {
  margin: 0;
  font-size: 18px;
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

.help-sections {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.help-section {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 16px;
}

.help-section h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-secondary, #4ecdc4);
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
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  padding: 4px 8px;
  font-family: monospace;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text, #ffffff);
  white-space: nowrap;
}

.shortcut-item span {
  color: var(--color-text-muted, rgba(255, 255, 255, 0.7));
  flex: 1;
}

.help-footer {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--color-divider, rgba(255, 255, 255, 0.1));
  text-align: center;
}

.help-footer p {
  margin: 0;
  font-size: 12px;
  color: var(--color-text-muted, rgba(255, 255, 255, 0.5));
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