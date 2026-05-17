<script setup lang="ts">
import { computed } from 'vue';
import type { SemanticStep } from '@/types/timeline';
import { operationNames } from '@/locales/zh-CN';

interface Props {
  currentStep: SemanticStep | null;
  currentStepIndex: number;
  totalSteps: number;
  comparisons: number;
  swaps: number;
  algorithm: string;
  isPlaying: boolean;
}

const props = defineProps<Props>();

const displayDescription = computed(() => {
  if (!props.currentStep) return '准备就绪';
  return props.currentStep.brief ?? props.currentStep.description ?? '执行中...';
});

const currentPhase = computed(() => {
  return props.currentStep?.context?.phase ?? '排序阶段';
});

const importanceClass = computed(() => {
  const importance = props.currentStep?.context?.importance;
  if (importance === 'high') return 'importance-high';
  if (importance === 'medium') return 'importance-medium';
  return 'importance-low';
});

const hasHint = computed(() => {
  return Boolean(props.currentStep?.context?.hint);
});

const hintContent = computed(() => {
  return props.currentStep?.context?.hint || '';
});

const progressPercentage = computed(() => {
  if (props.totalSteps === 0) return 0;
  return Math.round((props.currentStepIndex / props.totalSteps) * 100);
});

const hasDepthInfo = computed(() => {
  return props.currentStep?.context?.depth !== undefined;
});

const currentDepth = computed(() => {
  return props.currentStep?.context?.depth ?? 0;
});

const operationLabel = computed(() => {
  if (!props.currentStep) return '';
  return operationNames[props.currentStep.type] || props.currentStep.type;
});

const statusIndicatorColor = computed(() => {
  if (props.isPlaying) return '#4ade80';
  if (props.currentStep?.type === 'sorted') return '#4a9eff';
  return '#fbbf24';
});
</script>

<template>
  <div class="enhanced-status-bar">
    <!-- 左侧：主要操作信息 -->
    <div class="status-main">
      <div class="status-indicator" :style="{ backgroundColor: statusIndicatorColor }"></div>
      <div class="operation-info">
        <div class="operation-type">{{ operationLabel }}</div>
        <div class="operation-description" :class="importanceClass">
          {{ displayDescription }}
        </div>
      </div>
    </div>

    <!-- 中间：阶段和进度信息 -->
    <div class="status-middle">
      <div class="phase-indicator">
        <span class="phase-label">阶段：</span>
        <span class="phase-value">{{ currentPhase }}</span>
        <span v-if="hasDepthInfo" class="depth-info">(深度: {{ currentDepth }})</span>
      </div>
      <div class="progress-indicator">
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: `${progressPercentage}%` }"
          ></div>
        </div>
        <span class="progress-text">{{ progressPercentage }}%</span>
      </div>
    </div>

    <!-- 右侧：统计信息 -->
    <div class="status-stats">
      <div class="stat-item">
        <span class="stat-label">步骤</span>
        <span class="stat-value">{{ currentStepIndex + 1 }}/{{ totalSteps }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">比较</span>
        <span class="stat-value comparisons">{{ comparisons }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">交换</span>
        <span class="stat-value swaps">{{ swaps }}</span>
      </div>
      <div v-if="hasHint" class="stat-item hint-item">
        <span class="hint-icon" title="学习提示">💡</span>
      </div>
    </div>

    <!-- 学习提示弹窗（当有提示时显示） -->
    <div v-if="hasHint" class="hint-tooltip">
      <div class="hint-content">{{ hintContent }}</div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.enhanced-status-bar {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  background: rgba(10, 10, 20, 0.9);
  border: 1px solid rgba(74, 158, 255, 0.2);
  border-radius: 8px;
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  font-family: 'JetBrains Mono', monospace;
  transition: all 0.3s ease;
}

.enhanced-status-bar:hover {
  border-color: rgba(74, 158, 255, 0.3);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
}

/* 左侧主要信息 */
.status-main {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 8px currentColor;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform: scale(1.1);
  }
}

.operation-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.operation-type {
  font-size: 10px;
  color: #8b95a8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
}

.operation-description {
  font-size: 13px;
  color: #e0e0e0;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.operation-description.importance-high {
  color: #fbbf24;
  font-weight: 600;
}

.operation-description.importance-medium {
  color: #4a9eff;
}

.operation-description.importance-low {
  color: #9ca3af;
}

/* 中间信息 */
.status-middle {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
}

.phase-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
}

.phase-label {
  color: #8b95a8;
}

.phase-value {
  color: #4adeee;
  font-weight: 600;
}

.depth-info {
  color: #fbbf24;
  font-size: 10px;
  margin-left: 4px;
}

.progress-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.progress-bar {
  width: 80px;
  height: 4px;
  background: rgba(74, 158, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4a9eff, #4ecdc4);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 10px;
  color: #8b95a8;
  min-width: 35px;
}

/* 右侧统计信息 */
.status-stats {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.stat-label {
  font-size: 9px;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  font-size: 12px;
  color: #4a9eff;
  font-weight: 600;
  min-width: 30px;
  text-align: center;
}

.stat-value.comparisons {
  color: #fbbf24;
}

.stat-value.swaps {
  color: #4ade80;
}

.hint-item {
  cursor: help;
  transition: transform 0.2s ease;
}

.hint-item:hover {
  transform: scale(1.2);
}

.hint-icon {
  font-size: 14px;
  filter: drop-shadow(0 0 4px rgba(251, 191, 36, 0.6));
}

/* 学习提示弹窗 */
.hint-tooltip {
  position: absolute;
  bottom: 100%;
  right: 16px;
  margin-bottom: 8px;
  max-width: 300px;
  z-index: 100;
  opacity: 0;
  visibility: hidden;
  transition: all 0.3s ease;
  transform: translateY(8px);
}

.hint-item:hover ~ .hint-tooltip {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

.hint-content {
  padding: 8px 12px;
  background: rgba(251, 191, 36, 0.95);
  color: #1f2937;
  font-size: 11px;
  line-height: 1.4;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  font-weight: 500;
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .enhanced-status-bar {
    flex-wrap: wrap;
    gap: 12px;
  }

  .status-main {
    flex-basis: 100%;
    order: 1;
  }

  .status-middle {
    order: 2;
  }

  .status-stats {
    order: 3;
  }
}

@media (max-width: 768px) {
  .enhanced-status-bar {
    padding: 10px 12px;
    gap: 10px;
  }

  .operation-description {
    font-size: 12px;
  }

  .progress-bar {
    width: 60px;
  }

  .stat-item {
    gap: 1px;
  }

  .stat-label {
    font-size: 8px;
  }

  .stat-value {
    font-size: 11px;
    min-width: 25px;
  }
}
</style>
