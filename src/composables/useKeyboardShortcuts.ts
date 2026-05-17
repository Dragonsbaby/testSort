import { onMounted, onUnmounted } from 'vue';
import { useThemeStore } from '@/stores/themeStore';

export interface KeyboardShortcutHandlers {
  onPlayPause?: () => void;
  onStop?: () => void;
  onStepForward?: () => void;
  onStepBack?: () => void;
  onSeekStart?: () => void;
  onSeekEnd?: () => void;
  onSeekForward?: () => void;
  onSeekBackward?: () => void;
}

/**
 * 键盘快捷键 Composable
 * 提供标准的播放控制键盘快捷键
 */
export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers) {
  function handleKeyDown(event: KeyboardEvent) {
    // 如果用户正在输入，不触发快捷键
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLSelectElement
    ) {
      return;
    }

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

    // PageUp: 快速后退10步
    if (event.code === 'PageUp' && handlers.onSeekBackward) {
      event.preventDefault();
      handlers.onSeekBackward();
      return;
    }

    // PageDown: 快速前进10步
    if (event.code === 'PageDown' && handlers.onSeekForward) {
      event.preventDefault();
      handlers.onSeekForward();
      return;
    }

    // End: 跳转到最后
    if (event.code === 'End' && handlers.onSeekEnd) {
      event.preventDefault();
      handlers.onSeekEnd();
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
 * 主题系统键盘快捷键 Composable
 */
export function useThemeKeyboardShortcuts() {
  const themeStore = useThemeStore();

  function handleThemeKeydown(event: KeyboardEvent) {
    // 如果用户正在输入，不触发快捷键
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLSelectElement
    ) {
      return;
    }

    // Alt + T: 切换到下一个主题
    if (event.altKey && event.key === 't') {
      event.preventDefault();
      themeStore.nextTheme();
      return;
    }

    // Alt + Shift + T: 切换到上一个主题
    if (event.altKey && event.shiftKey && event.key === 'T') {
      event.preventDefault();
      themeStore.previousTheme();
      return;
    }

    // Alt + D: 切换深色/浅色模式
    if (event.altKey && event.key === 'd') {
      event.preventDefault();
      themeStore.toggleDarkMode();
      return;
    }

    // Alt + R: 重置为默认主题
    if (event.altKey && event.key === 'r') {
      event.preventDefault();
      themeStore.resetToDefault();
      return;
    }

    // 数字键 1-6: 快速切换到指定主题
    if (event.altKey && !event.shiftKey && !event.ctrlKey) {
      const themes = ['dark', 'light', 'cyberpunk', 'ocean', 'sunset', 'forest'] as const;
      const keyIndex = parseInt(event.key) - 1;

      if (keyIndex >= 0 && keyIndex < themes.length) {
        event.preventDefault();
        themeStore.setTheme(themes[keyIndex]);
        return;
      }
    }
  }

  onMounted(() => {
    document.addEventListener('keydown', handleThemeKeydown);
  });

  onUnmounted(() => {
    document.removeEventListener('keydown', handleThemeKeydown);
  });
}

/**
 * 快捷键说明映射
 */
export const KEYBOARD_SHORTCUTS_HELP = {
  playPause: { key: 'Space', description: '播放/暂停' },
  stop: { key: 'Home', description: '停止并回到开头' },
  stepForward: { key: '→/↓', description: '单步前进' },
  stepBack: { key: '←/↑', description: '单步后退' },
  seekForward: { key: 'PageDown', description: '快速前进10步' },
  seekBackward: { key: 'PageUp', description: '快速后退10步' },
  seekEnd: { key: 'End', description: '跳转到最后' },
  themeNext: { key: 'Alt+T', description: '下一个主题' },
  themePrev: { key: 'Alt+Shift+T', description: '上一个主题' },
  themeToggleDark: { key: 'Alt+D', description: '切换深色/浅色' },
  themeReset: { key: 'Alt+R', description: '重置主题' },
  themeQuick1: { key: 'Alt+1', description: '深色经典' },
  themeQuick2: { key: 'Alt+2', description: '明亮清新' },
  themeQuick3: { key: 'Alt+3', description: '赛博朋克' },
  themeQuick4: { key: 'Alt+4', description: '深海探险' },
  themeQuick5: { key: 'Alt+5', description: '日落余晖' },
  themeQuick6: { key: 'Alt+6', description: '森林秘境' },
} as const;
