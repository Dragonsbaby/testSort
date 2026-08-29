import { onMounted, onUnmounted } from 'vue';
import { useThemeStore } from '@/stores/themeStore';

export interface KeyboardShortcutHandlers {
  onPlayPause?: () => void;
  onStop?: () => void;
  onStepForward?: () => void;
  onStepBack?: () => void;
}

/** 输入控件聚焦时不响应快捷键 */
function isTypingTarget(event: KeyboardEvent) {
  return event.target instanceof HTMLInputElement
    || event.target instanceof HTMLTextAreaElement
    || event.target instanceof HTMLSelectElement;
}

/**
 * 键盘快捷键 Composable
 * 提供标准的播放控制键盘快捷键
 */
export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers) {
  function handleKeyDown(event: KeyboardEvent) {
    if (isTypingTarget(event)) return;

    // Space: 播放/暂停
    if (event.code === 'Space' && handlers.onPlayPause) {
      event.preventDefault();
      handlers.onPlayPause();
      return;
    }

    // Home: 停止并回到开头
    if (event.code === 'Home' && handlers.onStop) {
      event.preventDefault();
      handlers.onStop();
      return;
    }

    // ArrowRight / ArrowDown: 单步前进
    if (
      (event.code === 'ArrowRight' || event.code === 'ArrowDown') &&
      handlers.onStepForward
    ) {
      event.preventDefault();
      handlers.onStepForward();
      return;
    }

    // ArrowLeft / ArrowUp: 单步后退
    if (
      (event.code === 'ArrowLeft' || event.code === 'ArrowUp') &&
      handlers.onStepBack
    ) {
      event.preventDefault();
      handlers.onStepBack();
      return;
    }
  }

  onMounted(() => {
    document.addEventListener('keydown', handleKeyDown);
  });

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeyDown);
  });
}

/**
 * 主题快捷键 Composable（双城时代仅剩深浅切换）
 */
export function useThemeKeyboardShortcuts() {
  const themeStore = useThemeStore();

  function handleThemeKeydown(event: KeyboardEvent) {
    if (isTypingTarget(event)) return;

    // Alt + D: 切换深色/浅色模式
    if (event.altKey && event.key === 'd') {
      event.preventDefault();
      themeStore.toggleDarkMode();
    }
  }

  onMounted(() => {
    document.addEventListener('keydown', handleThemeKeydown);
  });

  onUnmounted(() => {
    document.removeEventListener('keydown', handleThemeKeydown);
  });
}
