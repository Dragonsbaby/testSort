<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  isPlaying: boolean;
  stepForwardDisabled: boolean;
  stepBackDisabled: boolean;
  isAtStart: boolean;
  isAtEnd: boolean;
}

interface Emits {
  (e: 'play'): void;
  (e: 'pause'): void;
  (e: 'stop'): void;
  (e: 'stepForward'): void;
  (e: 'stepBack'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const playPauseIcon = computed(() => props.isPlaying ? 'pause' : 'play');
const playPauseLabel = computed(() => props.isPlaying ? '暂停' : '播放');
const stopDisabled = computed(() => props.isAtStart);
</script>

<template>
  <div class="playback-controls">
    <!-- 停止按钮 -->
    <button
      class="control-btn stop-btn"
      :disabled="stopDisabled"
      @click="emit('stop')"
      title="停止并回到开头 (Home)"
    >
      <svg class="icon" viewBox="0 0 24 24" fill="currentColor">
        <rect x="6" y="6" width="12" height="12" rx="1" />
      </svg>
    </button>

    <!-- 单步后退按钮 -->
    <button
      class="control-btn step-btn"
      :disabled="stepBackDisabled"
      @click="emit('stepBack')"
      title="单步后退 (←)"
    >
      <svg class="icon" viewBox="0 0 24 24" fill="currentColor">
        <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
      </svg>
    </button>

    <!-- 播放/暂停按钮 -->
    <button
      class="control-btn play-pause-btn"
      :disabled="isAtEnd"
      @click="isPlaying ? emit('pause') : emit('play')"
      :title="`${playPauseLabel} (Space)`"
    >
      <svg class="icon" viewBox="0 0 24 24" fill="currentColor">
        <path v-if="playPauseIcon === 'play'" d="M8 5v14l11-7z" />
        <path v-else d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
      </svg>
      <span class="btn-label">{{ playPauseLabel }}</span>
    </button>

    <!-- 单步前进按钮 -->
    <button
      class="control-btn step-btn"
      :disabled="stepForwardDisabled"
      @click="emit('stepForward')"
      title="单步前进 (→)"
    >
      <svg class="icon" viewBox="0 0 24 24" fill="currentColor">
        <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
      </svg>
    </button>
  </div>
</template>

<style lang="scss" scoped>
.playback-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px;
}

.control-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  padding: 8px 12px;
  border: 1px solid rgba(74, 158, 255, 0.3);
  background: rgba(74, 158, 255, 0.08);
  color: #4a9eff;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 40px;
  height: 36px;
}

.control-btn:hover:not(:disabled) {
  background: rgba(74, 158, 255, 0.15);
  border-color: rgba(74, 158, 255, 0.5);
  box-shadow: 0 0 12px rgba(74, 158, 255, 0.2);
  transform: translateY(-1px);
}

.control-btn:active:not(:disabled) {
  transform: translateY(0);
}

.control-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none;
}

.play-pause-btn {
  padding: 8px 16px;
  min-width: 80px;
  background: rgba(78, 205, 196, 0.1);
  border-color: rgba(78, 205, 196, 0.4);
  color: #4ecdc4;
}

.play-pause-btn:hover:not(:disabled) {
  background: rgba(78, 205, 196, 0.2);
  border-color: rgba(78, 205, 196, 0.6);
  box-shadow: 0 0 12px rgba(78, 205, 196, 0.2);
}

.stop-btn:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.5);
  box-shadow: 0 0 12px rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.icon {
  width: 16px;
  height: 16px;
}

.btn-label {
  font-weight: 600;
}

@media (max-width: 768px) {
  .playback-controls {
    gap: 6px;
  }

  .control-btn {
    padding: 6px 10px;
    font-size: 12px;
    min-width: 36px;
    height: 32px;
  }

  .play-pause-btn {
    padding: 6px 12px;
    min-width: 70px;
  }

  .icon {
    width: 14px;
    height: 14px;
  }
}
</style>
