# 桶排序 UI 精美重构计划

## Context

当前桶排序可视化界面在 Canvas 层仅用单一青色渲染所有桶的柱子，桶格子无背景面板，标题字体偏小，计数徽章样式粗糙，分隔带区域视觉层次不清晰。参考截图已呈现「每桶独立色 + 彩色边框面板」的设计方向，本次重构目标是对齐并超越截图效果，实现生产级的精致视觉体验。

---

## 设计决策

| 层级 | 职责 |
|------|------|
| Canvas（`useCanvasRenderer`） | 桶面板背景、每桶独立配色柱子、标题/值域/徽章 overlay、分隔区标签 |
| HTML（`SortBarCanvasBucket.vue`） | 四角装饰改为青绿色（桶主调），无需新增 DOM 元素 |

---

## 配色方案（`BUCKET_PALETTE`，3–9 桶循环取用）

| 桶索引 | 主色 `border/bar` | 背景填充 `bgFill` |
|--------|-------------------|-------------------|
| 0 | `#4ecdc4` 青绿 | `rgba(78,205,196, 0.055)` |
| 1 | `#b979ff` 紫罗兰 | `rgba(185,121,255, 0.055)` |
| 2 | `#ffaa4e` 琥珀橙 | `rgba(255,170,78,  0.055)` |
| 3 | `#ff6b8a` 珊瑚红 | `rgba(255,107,138, 0.055)` |
| 4 | `#4ab0ff` 天蓝 | `rgba(74,176,255,  0.055)` |
| 5 | `#5dde8a` 草绿 | `rgba(93,222,138,  0.055)` |
| 6 | `#ff79c6` 玫瑰金 | `rgba(255,121,198, 0.055)` |
| 7 | `#f0d050` 金黄 | `rgba(240,208,80,  0.055)` |
| 8 | `#50e3c2` 薄荷绿 | `rgba(80,227,194,  0.055)` |

---

## 布局调整

```
主数组区高度 : height × 0.30  （原 0.33）
分隔带高度   : height × 0.07  （原 0.09）
桶区高度     : height × 0.63  （获得更多空间）
桶间距 gap   : 10px           （原 14px）
桶内顶部留白 : 40px           （标题 + 值域标签）
桶内底部留白 : 24px           （index 标签）
桶内左右 padding : 8px
```

---

## 新增 Overlay 类型：`region-panel`

用于绘制每个桶格子的圆角矩形背景面板（半透明填充 + 彩色边框 + 发光 + 活跃桶顶部高亮条）。需在 `RenderableOverlay.kind` 联合类型中新增此值，并增加可选字段：

```typescript
rect?: { x: number; y: number; width: number; height: number; radius: number };
accentBar?: string; // 活跃桶顶部高亮条颜色
```

---

## 需修改的文件（按实施顺序）

### Phase 1 — 数据层（新建 + 类型扩展）

**① 新建 `src/utils/frame/bucket-palette.ts`**
- 导出 `BucketTheme` 接口（`border/bar/barGlow/bgFill/borderGlow/badgeBg/badgeText`）
- 导出 `BUCKET_PALETTE: BucketTheme[]`（9 种颜色，见配色方案表）
- 导出 `getBucketTheme(bucketIndex: number): BucketTheme`（超出范围循环取用）

**② 修改 `src/types/timeline.ts`**
- `RenderableOverlay.kind` 新增 `'region-panel'`
- 新增可选字段 `rect?` 和 `accentBar?`

### Phase 2 — 布局

**③ 修改 `src/utils/layout/bucket-layout.ts`**
- `MAIN_RATIO = 0.30`，`SEPARATOR_RATIO = 0.07`，`gap = 10`
- 导出 `BUCKET_INNER_PADDING_TOP = 40`、`BUCKET_INNER_PADDING_BOT = 24`、`BUCKET_INNER_PADDING_X = 8`

### Phase 3 — 帧构建层

**④ 修改 `src/utils/timeline-builders/build-bucket-timeline.ts`**（改动最大）

- 引入 `getBucketTheme` 和 padding 常量
- 删除全局 `BUCKET_BASE_STYLE`，改为 `getBucketBarStyle(bucketIndex)` 函数（按桶动态返回颜色）
- `createBucketFrame()` 新增 `activeBucketIndex` 参数，传入 `buildBucketOverlays()`
- 桶内柱子 Y/高度计算适配 `BUCKET_INNER_PADDING_*`
- **完整重写 `buildBucketOverlays()`**：
  - `region-panel`：每桶一个圆角背景面板 overlay（含 `rect`、活跃桶 `accentBar`）
  - `bucket-title-N`：字体 13px bold，每桶独立主色；文字改为 `Bucket N`（英文，更优雅）
  - `bucket-range-N`：值域范围标签，位置 y+28，颜色柔和
  - `bucket-count-N`：徽章显示纯数字（当前元素数），尺寸加大
  - `bucket-separator-label`：分隔带居中 `▼  分  桶  区` 文字
  - `bucket-main-label`：`▸ 主数组区`，蓝色更醒目
  - `bucket-divider`：保留虚线分隔线

### Phase 4 — 渲染层

**⑤ 修改 `src/composables/useCanvasRenderer.ts`**

- 新增 `drawRegionPanel(ctx, overlay)` 函数：
  - 圆角矩形半透明填充
  - 彩色边框 + shadowBlur 外发光
  - 若有 `accentBar`，在顶部内侧绘制 2.5px 发光高亮条
- `drawOverlay()` 最前面新增 `region-panel` 分支，调用 `drawRegionPanel()`
- **修改 `draw()` 为三阶段绘制**：
  1. 先绘制所有 `region-panel` overlay（桶背景底层）
  2. 再绘制所有 entity（数据柱子中层）
  3. 最后绘制其余 overlay（label/badge/guide/divider 前景）
- `drawOverlay()` 中桶标题字号：`id.startsWith('bucket-title-')` 时用 `700 13px`；badge 字号从 10px 改为 13px

### Phase 5 — 视觉润色

**⑥ 修改 `src/components/SortBarCanvasBucket.vue`**
- 四角装饰 `.corner` 的 `border-color` 从 `rgba(74,158,255,0.8)` 改为 `rgba(78,205,196,0.7)`（青绿桶主调）
- `.sort-bar-canvas` 加 `box-shadow: inset 0 0 60px rgba(78,205,196,0.04)`（微弱内发光）

---

## 验证方式

1. 浏览器打开项目（`npm run dev`），切换到「桶排序」算法
2. 执行排序动画，检查：
   - 每个桶格子有独立彩色背景面板和边框
   - 当前操作桶（scatter/gather 时）顶部有高亮条且边框更亮
   - 桶内柱子颜色与桶边框颜色一致（各桶不同色）
   - 计数徽章实时更新并显示当前桶内元素数
   - 分隔带居中显示「▼  分  桶  区」
   - 3 桶 / 5 桶 / 9 桶场景下布局无溢出、无重叠
3. 静态检查：`pnpm tsc --noEmit` 无类型错误
