<script setup lang="ts">
import { computed } from 'vue';
import { useSortStore } from '@/stores/sortStore';
import { algorithmNames } from '@/locales/zh-CN';
import PlaybackControls from './PlaybackControls.vue';
import TimelineProgress from './TimelineProgress.vue';
import EnhancedStatusBar from './EnhancedStatusBar.vue';
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts';
import type { SemanticStep } from '@/types/timeline';

const SEEK_JUMP_STEPS = 10;

interface Props {
  isPlaying: boolean;
  currentStep: number;
  totalSteps: number;
  currentProgress: number;
  comparisons: number;
  swaps: number;
  currentStepInfo: SemanticStep | null;
  canStepForward: boolean;
  canStepBack: boolean;
  isAtStart: boolean;
  isAtEnd: boolean;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  onStepForward: () => void;
  onStepBack: () => void;
  onSeek: (step: number, progress: number) => void;
}

const props = defineProps<Props>();
const store = useSortStore();

function handleSeekForward() {
  props.onSeek(Math.min(props.currentStep + SEEK_JUMP_STEPS, props.totalSteps - 1), 0);
}

function handleSeekBackward() {
  props.onSeek(Math.max(props.currentStep - SEEK_JUMP_STEPS, 0), 0);
}

useKeyboardShortcuts({
  onPlayPause: () => props.isPlaying ? props.onPause() : props.onPlay(),
  onStop: props.onReset,
  onStepForward: props.onStepForward,
  onStepBack: props.onStepBack,
  onSeekForward: handleSeekForward,
  onSeekBackward: handleSeekBackward,
  onSeekStart: () => props.onSeek(0, 0),
  onSeekEnd: () => props.onSeek(props.totalSteps - 1, 1),
});

const algorithmName = computed(() => algorithmNames[store.algorithm] ?? store.algorithm);
</script>

<template>
  <div class="enhanced-control-panel">
    <!-- 顶部：原始控制面板 + 播放控制 -->
    <div class="control-section top-section">
      <slot name="default-controls"></slot>

      <!-- 分隔线 -->
      <div class="control-divider"></div>

      <!-- 播放控制按钮 -->
      <PlaybackControls
        :is-playing="isPlaying"
        :step-forward-disabled="!canStepForward"
        :step-back-disabled="!canStepBack"
        :is-at-start="isAtStart"
        :is-at-end="isAtEnd"
        @play="onPlay"
        @pause="onPause"
        @stop="onReset"
        @step-forward="onStepForward"
        @step-back="onStepBack"
      />
    </div>

    <!-- 中部：进度条 -->
    <div class="control-section progress-section">
      <TimelineProgress
        :current-step="currentStep"
        :total-steps="totalSteps"
        :current-progress="currentProgress"
        :disabled="totalSteps === 0"
        @seek="onSeek"
      />
    </div>

    <!-- 底部：增强状态栏 -->
    <div class="control-section status-section">
      <EnhancedStatusBar
        :current-step="currentStepInfo"
        :current-step-index="currentStep"
        :total-steps="totalSteps"
        :comparisons="comparisons"
        :swaps="swaps"
        :algorithm="algorithmName"
        :is-playing="isPlaying"
      />
    </div>

    <!-- 键盘快捷键提示 -->
    <div class="keyboard-hint">
      <span class="hint-title">键盘快捷键：</span>
      <span class="hint-item">Space 播放/暂停</span>
      <span class="hint-item">→ 单步前进</span>
      <span class="hint-item">← 单步后退</span>
      <span class="hint-item">Home 停止</span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.enhanced-control-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: rgba(10, 10, 20, 0.8);
  border: 1px solid rgba(74, 158, 255, 0.15);
  border-radius: 12px;
  backdrop-filter: blur(15px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
}

.control-section {
  display: flex;
  align-items: center;
}

.top-section {
  gap: 16px;
  flex-wrap: wrap;
}

.progress-section {
  justify-content: center;
}

.status-section {
  justify-content: center;
}

.control-divider {
  width: 1px;
  height: 40px;
  background: linear-gradient(180deg, transparent, rgba(74, 158, 255, 0.3) 50%, transparent);
  margin: 0 8px;
}

.keyboard-hint {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 12px;
  background: rgba(74, 158, 255, 0.05);
  border: 1px solid rgba(74, 158, 255, 0.1);
  border-radius: 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: #8b95a8;
  margin-top: 4px;
}

.hint-title {
  color: #4a9eff;
  font-weight: 600;
}

.hint-item {
  padding: 2px 6px;
  background: rgba(74, 158, 255, 0.1);
  border-radius: 3px;
  color: #9ca3af;
}

@media (max-width: 1024px) {
  .enhanced-control-panel {
    gap: 10px;
    padding: 12px;
  }

  .top-section {
    gap: 12px;
  }

  .keyboard-hint {
    flex-wrap: wrap;
    gap: 8px;
  }
}

@media (max-width: 768px) {
  .enhanced-control-panel {
    gap: 8px;
    padding: 10px;
  }

  .control-divider {
    display: none;
  }

  .keyboard-hint {
    font-size: 9px;
    padding: 4px 8px;
  }

  .hint-item {
    padding: 1px 4px;
  }
}
</style>
