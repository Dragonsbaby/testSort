<script setup lang="ts">
import { computed, ref } from 'vue';

interface Props {
  currentStep: number;
  totalSteps: number;
  currentProgress: number; // 0-1 当前步骤内的进度
  disabled?: boolean;
}

interface Emits {
  (e: 'seek', step: number, progress: number): void;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
});

const emit = defineEmits<Emits>();

const isDragging = ref(false);
const progressBarRef = ref<HTMLElement>();
const hoverPosition = ref<number | null>(null);

// 计算总的播放进度（包含当前步骤内的进度）
const totalProgress = computed(() => {
  if (props.totalSteps === 0) return 0;
  const stepProgress = props.currentStep / props.totalSteps;
  const currentStepProgress = props.currentProgress / props.totalSteps;
  return stepProgress + currentStepProgress;
});

// 显示的时间信息
const timeDisplay = computed(() => {
  const current = Math.min(props.currentStep + 1, props.totalSteps);
  const total = props.totalSteps;
  return `${current} / ${total}`;
});

// 处理进度条点击
function handleProgressBarClick(event: MouseEvent) {
  if (props.disabled || !progressBarRef.value) return;

  const rect = progressBarRef.value.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  const percentage = Math.max(0, Math.min(1, clickX / rect.width));

  // 计算目标步骤和进度
  const targetStep = Math.floor(percentage * props.totalSteps);
  const stepProgress = (percentage * props.totalSteps) % 1;

  emit('seek', targetStep, stepProgress);
}

// 处理拖拽开始
function handleDragStart(event: MouseEvent) {
  if (props.disabled) return;
  event.preventDefault();
  isDragging.value = true;
  document.addEventListener('mousemove', handleDragMove);
  document.addEventListener('mouseup', handleDragEnd);
}

// 处理拖拽移动
function handleDragMove(event: MouseEvent) {
  if (!isDragging.value || !progressBarRef.value) return;

  const rect = progressBarRef.value.getBoundingClientRect();
  const dragX = event.clientX - rect.left;
  const percentage = Math.max(0, Math.min(1, dragX / rect.width));

  hoverPosition.value = percentage * 100;
}

// 处理拖拽结束
function handleDragEnd(event: MouseEvent) {
  if (!isDragging.value || !progressBarRef.value) return;

  const rect = progressBarRef.value.getBoundingClientRect();
  const dragX = event.clientX - rect.left;
  const percentage = Math.max(0, Math.min(1, dragX / rect.width));

  const targetStep = Math.floor(percentage * props.totalSteps);
  const stepProgress = (percentage * props.totalSteps) % 1;

  emit('seek', targetStep, stepProgress);

  isDragging.value = false;
  hoverPosition.value = null;
  document.removeEventListener('mousemove', handleDragMove);
  document.removeEventListener('mouseup', handleDragEnd);
}

function handleMouseMove(event: MouseEvent) {
  if (props.disabled || !progressBarRef.value) return;

  const rect = progressBarRef.value.getBoundingClientRect();
  const hoverX = event.clientX - rect.left;
  const percentage = Math.max(0, Math.min(1, hoverX / rect.width));

  hoverPosition.value = percentage * 100;
}

function handleMouseLeave() {
  if (!isDragging.value) {
    hoverPosition.value = null;
  }
}
</script>

<template>
  <div class="timeline-progress" :class="{ disabled, dragging: isDragging }">
    <div class="progress-info">
      <span class="time-display">{{ timeDisplay }}</span>
      <span class="percentage-display">{{ Math.round(totalProgress * 100) }}%</span>
    </div>

    <div
      ref="progressBarRef"
      class="progress-bar-container"
      :class="{ 'is-dragging': isDragging }"
      @click="handleProgressBarClick"
      @mousemove="handleMouseMove"
      @mouseleave="handleMouseLeave"
    >
      <!-- 背景轨道 -->
      <div class="progress-bar-track"></div>

      <!-- 已播放进度 -->
      <div
        class="progress-bar-fill"
        :style="{ width: `${totalProgress * 100}%` }"
      ></div>

      <!-- 悬停/拖拽指示器 -->
      <div
        v-if="hoverPosition !== null"
        class="hover-indicator"
        :style="{ left: `${hoverPosition}%` }"
      ></div>

      <!-- 拖拽手柄 -->
      <div
        class="progress-handle"
        :class="{ 'is-dragging': isDragging }"
        :style="{ left: `${totalProgress * 100}%` }"
        @mousedown="handleDragStart"
      ></div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.timeline-progress {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 0;
  user-select: none;
}

.timeline-progress.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: #8b95a8;
}

.time-display {
  font-weight: 600;
  color: #4a9eff;
}

.percentage-display {
  color: #4adeee;
}

.progress-bar-container {
  position: relative;
  height: 24px;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.progress-bar-container:hover {
  transform: scaleY(1.1);
}

.progress-bar-container.is-dragging {
  cursor: grabbing;
  transform: scaleY(1.15);
}

.progress-bar-track {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 6px;
  background: rgba(74, 158, 255, 0.1);
  border: 1px solid rgba(74, 158, 255, 0.2);
  border-radius: 3px;
  transform: translateY(-50%);
}

.progress-bar-fill {
  position: absolute;
  top: 50%;
  left: 0;
  height: 6px;
  background: linear-gradient(90deg, rgba(74, 158, 255, 0.6), rgba(78, 205, 196, 0.8));
  border-radius: 3px;
  transform: translateY(-50%);
  transition: width 0.1s linear;
  box-shadow: 0 0 8px rgba(74, 158, 255, 0.3);
}

.step-marker {
  position: absolute;
  top: 50%;
  width: 2px;
  height: 10px;
  background: rgba(74, 158, 255, 0.2);
  border-radius: 1px;
  transform: translateY(-50%);
  transition: all 0.2s ease;
}

.step-marker.active {
  height: 14px;
  background: rgba(74, 158, 255, 0.8);
  box-shadow: 0 0 6px rgba(74, 158, 255, 0.6);
}

.step-marker.completed {
  background: rgba(78, 205, 196, 0.4);
}

.hover-indicator {
  position: absolute;
  top: 50%;
  width: 2px;
  height: 16px;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 1px;
  transform: translateY(-50%);
  pointer-events: none;
  z-index: 1;
  box-shadow: 0 0 4px rgba(255, 255, 255, 0.5);
}

.progress-handle {
  position: absolute;
  top: 50%;
  width: 14px;
  height: 14px;
  background: #4a9eff;
  border: 2px solid #fff;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  cursor: grab;
  transition: all 0.2s ease;
  box-shadow: 0 0 8px rgba(74, 158, 255, 0.5);
  z-index: 2;
}

.progress-handle:hover {
  transform: translate(-50%, -50%) scale(1.2);
  box-shadow: 0 0 12px rgba(74, 158, 255, 0.7);
}

.progress-handle.is-dragging {
  cursor: grabbing;
  transform: translate(-50%, -50%) scale(1.3);
  box-shadow: 0 0 16px rgba(74, 158, 255, 0.9);
}

@media (max-width: 768px) {
  .progress-bar-container {
    height: 20px;
  }

  .progress-bar-track,
  .progress-bar-fill {
    height: 4px;
  }

  .progress-handle {
    width: 12px;
    height: 12px;
  }

  .step-marker {
    height: 8px;
  }

  .step-marker.active {
    height: 12px;
  }

  .hover-indicator {
    height: 12px;
  }
}
</style>
