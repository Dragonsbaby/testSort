# 🎨 主题系统集成完全指南

## 📋 目录
1. [快速开始](#快速开始)
2. [核心概念](#核心概念)
3. [安装步骤](#安装步骤)
4. [使用方法](#使用方法)
5. [自定义主题](#自定义主题)
6. [最佳实践](#最佳实践)
7. [故障排除](#故障排除)

---

## 🚀 快速开始

### 1. 基础使用（5分钟上手）

```vue
<script setup lang="ts">
import { useTheme } from '@/composables/useTheme';
import ThemeSwitcher from '@/components/ThemeSwitcher.vue';

const theme = useTheme();
</script>

<template>
  <div :style="{ backgroundColor: theme.getBackgroundColor() }">
    <h1 :style="{ color: theme.themeColors.text }">
      排序可视化 - {{ theme.currentTheme.name }}
    </h1>

    <!-- 主题切换按钮 -->
    <ThemeSwitcher />
  </div>
</template>
```

### 2. 在Canvas渲染中使用

```typescript
import { useTheme } from '@/composables/useTheme';

export function drawCanvas(ctx: CanvasRenderingContext2D) {
  const theme = useTheme();

  // 背景使用主题颜色
  ctx.fillStyle = theme.getBackgroundColor();
  ctx.fillRect(0, 0, width, height);

  // 网格使用主题颜色
  ctx.strokeStyle = theme.getGridColor();
  // ... 绘制网格
}
```

---

## 🎯 核心概念

### 主题系统架构

```
用户界面层
    ↓
ThemeSwitcher (主题切换器)
    ↓
ThemeStore (状态管理)
    ↓
Theme Composable (便捷API)
    ↓
组件层 (Vue组件 + Canvas渲染)
```

### 三大数据结构

1. **Theme (主题配置)**
   ```typescript
   interface Theme {
     id: ThemeId;           // 唯一标识
     name: string;          // 显示名称
     colors: ColorPalette;  // 颜色调色板
     stateStyles: Record;   // 状态样式映射
     effects: { /* ... */ }; // 视觉效果
     typography: { /* ... */ }; // 字体配置
     animation: { /* ... */ };  // 动画配置
   }
   ```

2. **ColorPalette (颜色调色板)**
   ```typescript
   interface ColorPalette {
     background: string;      // 背景色
     grid: string;           // 网格色
     baseline: string;       // 基线色
     text: string;           // 文字色
     primary: string;        // 主色调
     // ...更多颜色
   }
   ```

3. **StateStyleMapping (状态样式)**
   ```typescript
   interface StateStyleMapping {
     [stateTag: string]: RenderStyle;
   }

   // 示例
   {
     comparing: { fill: '#ffcc00', glow: 0.72 },
     swapping: { fill: '#ff5c5c', glow: 0.82 },
     sorted: { fill: '#33d17a', glow: 0.42 },
   }
   ```

---

## 🔧 安装步骤

### Step 1: 文件结构确认

确保以下文件已创建：
```
src/
├── types/
│   └── theme.ts                      # ✅ 主题类型定义
├── data/
│   └── themes.ts                     # ✅ 预设主题库
├── stores/
│   └── themeStore.ts                 # ✅ 主题状态管理
├── composables/
│   └── useTheme.ts                   # ✅ 主题Composable
├── components/
│   ├── ThemeSelector.vue             # ✅ 主题选择器
│   └── ThemeSwitcher.vue             # ✅ 主题切换器
└── utils/
    └── frame/
        └── style-utils.ts            # ✅ 已更新的样式工具
```

### Step 2: 在主应用中初始化

```typescript
// src/main.ts
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { useThemeStore } from '@/stores/themeStore';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);

// 初始化主题系统
const themeStore = useThemeStore();
themeStore.initialize();

app.mount('#app');
```

### Step 3: 在App.vue中添加主题切换器

```vue
<!-- src/App.vue -->
<script setup lang="ts">
import ThemeSwitcher from '@/components/ThemeSwitcher.vue';
</script>

<template>
  <div class="app-container">
    <header class="app-header">
      <h1>排序算法可视化</h1>
      <ThemeSwitcher />
    </header>

    <main class="app-main">
      <!-- 你的主要内容 -->
    </main>
  </div>
</template>

<style>
/* 应用主题CSS变量 */
.app-container {
  background-color: var(--color-background, #080d18);
  color: var(--color-text, #ffffff);
  transition: background-color 0.3s ease, color 0.3s ease;
}
</style>
```

---

## 📖 使用方法

### 1. 基础主题切换

```typescript
import { useTheme } from '@/composables/useTheme';

const theme = useTheme();

// 切换到指定主题
theme.switchTheme('cyberpunk');

// 切换深色/浅色模式
theme.toggleDarkMode();

// 下一个/上一个主题
theme.nextTheme();
theme.previousTheme();
```

### 2. Canvas渲染集成

#### 完整的Canvas组件示例

```vue
<!-- src/components/ThemedSortCanvas.vue -->
<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useTheme } from '@/composables/useTheme';

const props = defineProps<{
  entities: RenderableEntity[];
}>();

const canvasRef = ref<HTMLCanvasElement>();
const theme = useTheme();

function render() {
  const canvas = canvasRef.value;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { width, height } = canvas;

  // 1. 绘制背景（使用主题颜色）
  ctx.fillStyle = theme.getBackgroundColor();
  ctx.fillRect(0, 0, width, height);

  // 2. 绘制网格（使用主题网格色）
  ctx.strokeStyle = theme.getGridColor();
  ctx.lineWidth = 1;
  const gridSize = theme.themeEffects.value.gridSpacing;

  ctx.beginPath();
  for (let x = 0; x <= width; x += gridSize) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  ctx.stroke();

  // 3. 绘制基线（使用主题基线色）
  const baseY = height - 21.5;
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

  // 4. 绘制实体（使用主题实体样式）
  props.entities.forEach(entity => {
    drawEntity(ctx, entity);
  });
}

function drawEntity(ctx: CanvasRenderingContext2D, entity: RenderableEntity) {
  const style = theme.getStyleForState(entity.stateTags);

  // 应用样式
  ctx.fillStyle = style.fill || theme.themeColors.value.primary;
  ctx.strokeStyle = style.stroke || theme.themeColors.value.textSecondary;

  // 发光效果
  if (style.glow && style.glow > 0) {
    ctx.shadowBlur = theme.themeEffects.value.shadowBlur * style.glow;
    ctx.shadowColor = style.fill;
  }

  // 绘制实体
  const { x, y, width: w, height: h } = entity;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 4);
  ctx.fill();
  ctx.stroke();

  // 重置阴影
  ctx.shadowBlur = 0;

  // 绘制数值标签
  ctx.fillStyle = style.text || theme.themeColors.value.text;
  ctx.font = theme.themeTypography.value.valueFont;
  ctx.textAlign = 'center';
  ctx.fillText(entity.value.toString(), x + w / 2, y - 8);
}

// 监听实体变化
watch(() => props.entities, render, { deep: true });

// 监听主题变化
watch(theme.currentThemeId, render);

onMounted(render);
</script>

<template>
  <canvas
    ref="canvasRef"
    :width="800"
    :height="600"
    class="themed-canvas"
  />
</template>

<style scoped>
.themed-canvas {
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  transition: box-shadow 0.3s ease;
}
</style>
```

### 3. 响应式样式绑定

```vue
<template>
  <div
    class="sort-container"
    :style="containerStyles"
  >
    <div
      class="status-bar"
      :style="statusBarStyles"
    >
      <span :style="textStyles">比较次数: {{ comparisons }}</span>
      <span :style="textStyles">交换次数: {{ swaps }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useTheme } from '@/composables/useTheme';

const theme = useTheme();

const containerStyles = computed(() => ({
  backgroundColor: theme.getBackgroundColor(),
  borderColor: theme.themeColors.value.divider,
  color: theme.themeColors.value.text,
  transition: 'all 0.3s ease',
}));

const statusBarStyles = computed(() => ({
  backgroundColor: theme.themeColors.value.backgroundSecondary,
  borderBottom: `1px solid ${theme.themeColors.value.divider}`,
}));

const textStyles = computed(() => ({
  color: theme.themeColors.value.textSecondary,
  fontFamily: theme.themeTypography.value.labelFont,
}));
</script>
```

---

## 🎨 自定义主题

### 创建新主题

```typescript
// src/data/themes.ts
export const THEME_PRESETS: ThemePreset = {
  default: "dark",
  themes: [
    // ... 现有主题

    // 添加你的自定义主题
    {
      id: "my-custom-theme",
      name: "我的主题",
      description: "自定义的主题描述",

      colors: {
        background: "#1a1a2e",
        backgroundSecondary: "#16213e",
        grid: "rgba(233, 69, 96, 0.1)",
        baseline: "rgba(233, 69, 96, 0.5)",
        divider: "rgba(233, 69, 96, 0.2)",
        text: "#eeeeee",
        textSecondary: "#e94560",
        textMuted: "rgba(238, 238, 238, 0.5)",
        primary: "#e94560",
      },

      stateStyles: {
        comparing: {
          fill: "#ffd700",
          stroke: "rgba(255, 215, 0, 0.9)",
          text: "#1a1a2e",
          glow: 0.8
        },
        // ... 其他状态样式
      },

      effects: {
        gridSpacing: 40,
        gridOpacity: 0.1,
        baselineGlow: true,
        baselineOpacity: 0.5,
        shadowBlur: 20,
      },

      typography: {
        labelFont: "600 11px 'Segoe UI', sans-serif",
        valueFont: "bold 14px 'Segoe UI', sans-serif",
        monospaceFont: "12px 'Consolas', monospace"
      },

      animation: {
        easing: "easeOutCubic",
        transitionSpeed: 1.0
      }
    }
  ]
};
```

### 动态主题生成

```typescript
// 高级：根据用户偏好生成主题
function generateCustomTheme(
  primaryColor: string,
  isDark: boolean
): Theme {
  return {
    id: "custom",
    name: "自定义主题",
    description: "用户生成的主题",

    colors: {
      background: isDark ? "#1a1a2e" : "#f8f9fa",
      grid: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
      baseline: primaryColor,
      text: isDark ? "#ffffff" : "#212529",
      primary: primaryColor,
      // ... 其他颜色
    },

    stateStyles: {
      // 基于主色调生成状态样式
      comparing: {
        fill: adjustBrightness(primaryColor, 40),
        stroke: primaryColor,
        glow: 0.7
      },
      // ... 其他状态
    },

    effects: {
      gridSpacing: 40,
      gridOpacity: 0.1,
      baselineGlow: true,
      baselineOpacity: 0.5,
      shadowBlur: 18,
    },

    typography: {
      labelFont: "600 11px system-ui",
      valueFont: "bold 14px system-ui",
      monospaceFont: "12px monospace"
    },

    animation: {
      easing: "easeOutCubic",
      transitionSpeed: 1.0
    }
  };
}

// 辅助函数：调整颜色亮度
function adjustBrightness(color: string, percent: number): string {
  // 实现颜色亮度调整逻辑
  return color; // 简化示例
}
```

---

## 🏆 最佳实践

### 1. 渐进式迁移策略

```typescript
// 第一阶段：新功能使用主题系统
export function NewComponent() {
  const theme = useTheme();
  // 新代码直接使用主题系统
}

// 第二阶段：重构现有组件
export function LegacyComponent() {
  // 保留原有逻辑，添加主题支持
  const theme = useTheme();

  function getBackgroundColor() {
    // 优先使用主题，回退到硬编码
    return theme?.getBackgroundColor() || '#080d18';
  }
}

// 第三阶段：完全迁移
export function RefactoredComponent() {
  const theme = useTheme();
  // 完全基于主题系统
}
```

### 2. 性能优化

```typescript
// ❌ 错误：在render循环中重复调用
function renderLoop() {
  for (let i = 0; i < 1000; i++) {
    const bgColor = theme.getBackgroundColor(); // 每次都调用
  }
}

// ✅ 正确：缓存主题值
function renderLoop() {
  const bgColor = theme.getBackgroundColor(); // 只调用一次
  for (let i = 0; i < 1000; i++) {
    // 使用缓存的值
  }
}
```

### 3. 主题过渡动画

```css
/* 全局CSS */
body.theme-transitioning,
body.theme-transitioning * {
  transition-property:
    background-color,
    color,
    border-color,
    fill,
    stroke !important;
  transition-duration: 300ms !important;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1) !important;
}
```

### 4. 测试覆盖

```typescript
// 主题系统测试
import { describe, it, expect } from 'vitest';
import { useTheme } from '@/composables/useTheme';

describe('主题系统', () => {
  it('应该正确切换主题', () => {
    const theme = useTheme();

    theme.switchTheme('light');
    expect(theme.currentThemeId.value).toBe('light');
    expect(theme.isDarkTheme.value).toBe(false);
  });

  it('应该返回正确的颜色值', () => {
    const theme = useTheme();

    theme.switchTheme('dark');
    expect(theme.getBackgroundColor()).toBe('#080d18');
  });

  it('应该正确获取实体样式', () => {
    const theme = useTheme();

    const style = theme.getStyleForState(['comparing']);
    expect(style.fill).toBeTruthy();
    expect(style.glow).toBeGreaterThan(0);
  });
});
```

---

## 🔍 故障排除

### 常见问题解决

#### 1. 主题切换后Canvas没有更新

```typescript
// ❌ 问题：没有监听主题变化
function renderCanvas() {
  // 只在初始化时渲染
}

// ✅ 解决：监听主题变化
watch(() => theme.currentThemeId, () => {
  renderCanvas(); // 主题切换时重新渲染
});
```

#### 2. 颜色不一致

```typescript
// ❌ 问题：混用硬编码和主题系统
const styles = {
  background: '#080d18', // 硬编码
  color: theme.getBackgroundColor(), // 主题系统
};

// ✅ 解决：统一使用主题系统
const styles = {
  background: theme.getBackgroundColor(),
  color: theme.themeColors.value.text,
};
```

#### 3. 性能问题

```typescript
// ❌ 问题：在频繁调用的函数中使用主题
function animate() {
  requestAnimationFrame(() => {
    const color = theme.getGridColor(); // 每帧都调用
    animate();
  });
}

// ✅ 解决：在组件级别缓存
const gridColor = computed(() => theme.getGridColor());

function animate() {
  requestAnimationFrame(() => {
    const color = gridColor.value; // 使用计算属性缓存
    animate();
  });
}
```

#### 4. TypeScript类型错误

```typescript
// ❌ 问题：类型不匹配
const themeId: string = 'dark'; // string类型
theme.switchTheme(themeId); // 类型错误

// ✅ 解决：使用正确的类型
const themeId: ThemeId = 'dark'; // ThemeId类型
theme.switchTheme(themeId); // 正确
```

---

## 📊 主题系统对比

### 传统硬编码 vs 主题系统

| 特性 | 硬编码方式 | 主题系统 |
|------|-----------|---------|
| 可维护性 | ❌ 分散在各个文件 | ✅ 集中管理 |
| 可扩展性 | ❌ 需要修改多处 | ✅ 添加新主题即可 |
| 用户体验 | ❌ 无法切换 | ✅ 多主题选择 |
| 开发效率 | ❌ 重复代码多 | ✅ 代码复用高 |
| 一致性 | ❌ 容易不一致 | ✅ 保证统一 |
| 测试覆盖 | ❌ 难以测试 | ✅ 易于测试 |

---

## 🎯 总结

主题系统为排序可视化项目带来了：

1. **更好的用户体验** - 6种精心设计的主题
2. **更高的代码质量** - 集中化、可维护的样式管理
3. **更强的扩展性** - 轻松添加新主题和样式
4. **更佳的性能** - 响应式设计，按需更新
5. **更简单的开发** - 统一的API，易于使用

开始使用主题系统，让你的排序可视化更加出彩！🚀