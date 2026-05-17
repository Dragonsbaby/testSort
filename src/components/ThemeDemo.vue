<template>
  <div class="theme-demo">
    <!-- 顶部控制栏 -->
    <div class="demo-controls">
      <h2>🎨 主题系统演示</h2>
      <ThemeSwitcher />

      <div class="control-group">
        <button @click="showCode = !showCode" class="demo-btn">
          {{ showCode ? '隐藏' : '显示' }}代码
        </button>
        <button @click="runDemo" class="demo-btn primary">
          ▶️ 运行演示
        </button>
      </div>
    </div>

    <!-- 演示区域 -->
    <div class="demo-content">
      <!-- 状态信息卡片 -->
      <div class="info-cards">
        <div class="info-card">
          <h4>当前主题</h4>
          <div class="card-value">{{ theme.currentTheme.value.name }}</div>
          <div class="card-desc">{{ theme.currentTheme.value.description }}</div>
        </div>

        <div class="info-card">
          <h4>主题类型</h4>
          <div class="card-value">
            <span v-if="theme.isDarkTheme.value">🌙 深色主题</span>
            <span v-else>🌞 浅色主题</span>
          </div>
        </div>

        <div class="info-card">
          <h4>主色调</h4>
          <div class="color-preview">
            <div
              class="color-box"
              :style="{ background: theme.themeColors.value.primary }"
            ></div>
            <div class="color-value">{{ theme.themeColors.value.primary }}</div>
          </div>
        </div>

        <div class="info-card">
          <h4>特效状态</h4>
          <div class="card-value">
            {{ theme.themeEffects.value.baselineGlow ? '✨ 发光开启' : '💡 发光关闭' }}
          </div>
          <div class="card-desc">
            粒子效果: {{ theme.themeEffects.value.particleEffect ? '开启' : '关闭' }}
          </div>
        </div>
      </div>

      <!-- Canvas演示 -->
      <div class="canvas-section">
        <h3>Canvas 渲染演示</h3>
        <canvas
          ref="demoCanvas"
          :width="800"
          :height="400"
          class="demo-canvas"
        ></canvas>

        <div class="canvas-controls">
          <button @click="clearCanvas" class="control-btn">清除</button>
          <button @click="drawSampleBars" class="control-btn">绘制示例</button>
          <button @click="animateBars" class="control-btn primary">动画演示</button>
        </div>
      </div>

      <!-- 状态样式演示 -->
      <div class="states-demo">
        <h3>状态样式演示</h3>
        <div class="state-bars">
          <div
            v-for="state in displayStates"
            :key="state.tag"
            class="state-bar-item"
          >
            <div
              class="state-bar"
              :style="getStateBarStyle(state.tag)"
            ></div>
            <div class="state-label">{{ state.label }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 代码显示区域 -->
    <transition name="slide">
      <div v-if="showCode" class="code-section">
        <h3>集成代码示例</h3>
        <pre><code>{{ usageCode }}</code></pre>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, onUnmounted } from 'vue';
import { useTheme } from '@/composables/useTheme';
import ThemeSwitcher from './ThemeSwitcher.vue';
import type { StateTag } from '@/types/timeline';

// 状态
const showCode = ref(false);
const demoCanvas = ref<HTMLCanvasElement>();
let animationId: number | null = null;

// 主题系统
const theme = useTheme();

// 演示用的状态列表
const displayStates = ref([
  { tag: 'comparing' as StateTag, label: '比较中' },
  { tag: 'swapping' as StateTag, label: '交换中' },
  { tag: 'sorted' as StateTag, label: '已排序' },
  { tag: 'pivot' as StateTag, label: '基准元素' },
  { tag: 'pending' as StateTag, label: '待处理' },
  { tag: 'latest' as StateTag, label: '最新' },
]);

// 生成代码示例
const usageCode = computed(() => `
// 1. 导入主题系统
import { useTheme } from '@/composables/useTheme';

const theme = useTheme();

// 2. 使用主题颜色
const backgroundColor = theme.getBackgroundColor();
const primaryColor = theme.themeColors.value.primary;

// 3. 在Canvas中使用
ctx.fillStyle = theme.getBackgroundColor();
ctx.fillRect(0, 0, width, height);

// 4. 获取实体样式
const style = theme.getStyleForState(['comparing']);
ctx.fillStyle = style.fill;

// 5. 监听主题变化
watch(() => theme.currentThemeId.value, () => {
  // 主题切换时重新渲染
  renderCanvas();
});
`);

// 获取状态柱样式
function getStateBarStyle(stateTag: StateTag) {
  const style = theme.getStyleForState([stateTag]);

  return {
    background: style.fill,
    boxShadow: style.glow && style.glow > 0
      ? `0 0 ${style.glow * 20}px ${style.fill}`
      : 'none',
    border: `2px solid ${style.stroke}`,
    transition: 'all 0.3s ease',
  };
}

// Canvas 绘制方法
function drawSampleBars() {
  const canvas = demoCanvas.value;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { width, height } = canvas;

  // 清空画布
  ctx.clearRect(0, 0, width, height);

  // 绘制背景
  ctx.fillStyle = theme.getBackgroundColor();
  ctx.fillRect(0, 0, width, height);

  // 绘制网格
  ctx.strokeStyle = theme.getGridColor();
  ctx.lineWidth = 1;
  const gridSize = theme.themeEffects.value.gridSpacing;

  ctx.beginPath();
  for (let x = 0; x <= width; x += gridSize) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let y = 0; y <= height; y += gridSize) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();

  // 绘制基线
  const baseY = height - 50;
  ctx.strokeStyle = theme.getBaselineColor();
  ctx.lineWidth = 2;

  if (theme.themeEffects.value.baselineGlow) {
    ctx.shadowBlur = theme.themeEffects.value.shadowBlur;
    ctx.shadowColor = theme.getBaselineColor();
  }

  ctx.beginPath();
  ctx.moveTo(0, baseY);
  ctx.lineTo(width, baseY);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // 绘制示例柱子
  const barWidth = 60;
  const barSpacing = 40;
  const startX = (width - (6 * barWidth + 5 * barSpacing)) / 2;

  displayStates.value.forEach((state, index) => {
    const x = startX + index * (barWidth + barSpacing);
    const barHeight = 50 + (index + 1) * 30;
    const y = baseY - barHeight;

    const style = theme.getStyleForState([state.tag]);

    // 绘制柱子
    ctx.fillStyle = style.fill || theme.themeColors.value.primary;
    ctx.strokeStyle = style.stroke || theme.themeColors.value.textSecondary;

    if (style.glow && style.glow > 0) {
      ctx.shadowBlur = theme.themeEffects.value.shadowBlur * style.glow;
      ctx.shadowColor = style.fill;
    }

    // 圆角矩形
    ctx.beginPath();
    ctx.roundRect(x, y, barWidth, barHeight, [8, 8, 0, 0]);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 数值标签
    ctx.fillStyle = style.text || theme.themeColors.value.text;
    ctx.font = theme.themeTypography.value.valueFont;
    ctx.textAlign = 'center';
    ctx.fillText(`${index + 1}0`, x + barWidth / 2, y - 10);

    // 状态标签
    ctx.font = theme.themeTypography.value.labelFont;
    ctx.fillText(state.label, x + barWidth / 2, baseY + 20);
  });
}

function clearCanvas() {
  const canvas = demoCanvas.value;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function animateBars() {
  if (animationId) {
    cancelAnimationFrame(animationId);
  }

  let progress = 0;
  const duration = 2000; // 2秒
  const startTime = Date.now();

  function animate() {
    const currentTime = Date.now();
    progress = Math.min(1, (currentTime - startTime) / duration);

    if (progress < 1) {
      drawSampleBars();
      animationId = requestAnimationFrame(animate);
    } else {
      animationId = null;
    }
  }

  animate();
}

function runDemo() {
  drawSampleBars();
  setTimeout(() => animateBars(), 1000);
}

// 监听主题变化
watch(() => theme.currentThemeId.value, () => {
  drawSampleBars();
});

// 组件挂载时初始化
onMounted(() => {
  drawSampleBars();
});

// 清理动画
onUnmounted(() => {
  if (animationId) {
    cancelAnimationFrame(animationId);
  }
});
</script>

<style scoped>
.theme-demo {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
  min-height: 100vh;
}

.demo-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--color-divider, rgba(255, 255, 255, 0.1));
}

.demo-controls h2 {
  margin: 0;
  font-size: 24px;
  color: var(--color-text, #ffffff);
}

.control-group {
  display: flex;
  gap: 12px;
}

.demo-btn {
  padding: 10px 20px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: var(--color-text, #ffffff);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.demo-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--color-primary, #4a9eff);
}

.demo-btn.primary {
  background: var(--color-primary, #4a9eff);
  border-color: var(--color-primary, #4a9eff);
  color: #ffffff;
}

.demo-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* 信息卡片 */
.info-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
}

.info-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 16px;
  transition: all 0.3s ease;
}

.info-card:hover {
  background: rgba(255, 255, 255, 0.08);
  transform: translateY(-2px);
}

.info-card h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-secondary, #4ecdc4);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.card-value {
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text, #ffffff);
  margin-bottom: 4px;
}

.card-desc {
  font-size: 12px;
  color: var(--color-text-muted, rgba(255, 255, 255, 0.5));
}

.color-preview {
  display: flex;
  align-items: center;
  gap: 12px;
}

.color-box {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.color-value {
  font-family: monospace;
  font-size: 14px;
  color: var(--color-text, #ffffff);
}

/* Canvas 演示 */
.canvas-section {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 20px;
}

.canvas-section h3 {
  margin: 0 0 16px 0;
  font-size: 18px;
  color: var(--color-text, #ffffff);
}

.demo-canvas {
  width: 100%;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  margin-bottom: 16px;
}

.canvas-controls {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.control-btn {
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: var(--color-text, #ffffff);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.control-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.control-btn.primary {
  background: var(--color-primary, #4a9eff);
  border-color: var(--color-primary, #4a9eff);
}

/* 状态演示 */
.states-demo {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 20px;
}

.states-demo h3 {
  margin: 0 0 16px 0;
  font-size: 18px;
  color: var(--color-text, #ffffff);
}

.state-bars {
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
}

.state-bar-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.state-bar {
  width: 60px;
  height: 120px;
  border-radius: 8px 8px 4px 4px;
}

.state-label {
  font-size: 12px;
  color: var(--color-text-muted, rgba(255, 255, 255, 0.5));
  font-weight: 500;
}

/* 代码区域 */
.code-section {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 20px;
  margin-top: 24px;
}

.code-section h3 {
  margin: 0 0 16px 0;
  font-size: 18px;
  color: var(--color-text, #ffffff);
}

.code-section pre {
  margin: 0;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 8px;
  padding: 16px;
  overflow-x: auto;
}

.code-section code {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #e0e0e0;
}

/* 过渡动画 */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .demo-controls {
    flex-direction: column;
    align-items: stretch;
  }

  .info-cards {
    grid-template-columns: 1fr;
  }

  .state-bars {
    flex-direction: column;
    align-items: center;
  }

  .canvas-controls {
    flex-direction: column;
  }

  .control-btn {
    width: 100%;
  }
}
</style>