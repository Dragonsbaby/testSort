import { onMounted, onUnmounted } from 'vue';

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
} as const;
