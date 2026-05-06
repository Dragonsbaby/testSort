# 调整基础排序 Canvas 柱体垂直位置计划

## Context

用户截图指出：期望基础排序的圆柱体/柱状元素整体处于画布中部偏下的舒适位置；当前实现中柱体底边和索引文字落在背景水平线下方，整体贴近底部，视觉不美观。

只读排查后确认，基础排序柱体的 y 坐标来自 [basic-layout.ts](../../src/utils/layout/basic-layout.ts) 中的 `buildBasicLayout()`：`baseY = height - BOTTOM_OFFSET`。渲染层 [useCanvasRenderer.ts](../../src/composables/useCanvasRenderer.ts) 将 `entity.y` 当作柱体底边，索引绘制在 `y + 17`；背景水平线绘制在实际 Canvas 的 `containerHeight - 21.5`。当前 `BOTTOM_OFFSET = 22`，在基础时间线高度 320 下，柱体底边约为 298，索引约为 315，容易显得压到底部或落到水平线下。

## 推荐方案

只调整基础布局的底部留白，不改渲染器、不改时间线结构。

### 修改文件

- [src/utils/layout/basic-layout.ts](../../src/utils/layout/basic-layout.ts)

### 修改内容

1. 将 `BOTTOM_OFFSET` 从 `22` 调整到约 `58`。
   - 基础时间线高度 320 时：
     - 柱体底边从 `298` 上移到 `262`。
     - 索引文字从约 `315` 上移到约 `279`。
   - 这样柱体和索引会从底部脱离，接近截图一中的中部偏下效果。

2. 保持 `TOP_PADDING = 48` 不变。
   - 最大柱高会随底部留白减少，但仍保留顶部空间。
   - 不引入额外缩放、居中算法或新抽象，避免影响其他排序时间线。

3. 不修改 [src/composables/useCanvasRenderer.ts](../../src/composables/useCanvasRenderer.ts)。
   - `drawBarEntity()` 是通用绘制逻辑，负责按 entity 坐标绘制柱体和值/索引标签。
   - 问题本质是基础布局给出的 baseline 太低，应在布局层修正。

4. 不修改 [src/composables/useSortAnimation.ts](../../src/composables/useSortAnimation.ts) 的基础时间线固定高度。
   - 将时间线高度动态绑定到实际 Canvas 高度会扩大变更范围，需要新的尺寸传递链路。
   - 本次诉求是修正当前基础柱体贴底问题，调整布局常量是最小有效改动。

## 影响范围

- 影响使用 `buildBasicTimeline()` 的基础柱状排序：bubble、insertion、quick、shell。
- 不影响 merge、bucket、heap 的专用时间线布局。
- 播放中的 swap、compare、highlight 等动画仍沿用同一 slot 坐标，整体会随初始布局一起上移。

## 风险与取舍

- 最大柱体高度会从 `320 - 48 - 22 = 250` 降到 `320 - 48 - 58 = 214`，柱体会略矮，但更符合“不要贴底、整体居中”的视觉目标。
- 如果后续希望在任意容器高度下严格垂直居中，需要进一步让时间线高度跟随实际 Canvas 尺寸；这不是本次最小修复范围。

## 验证方式

根据用户全局规则，不运行 dev/build/test 命令。实施后做静态核算和人工视觉验证：

1. 静态核算 [basic-layout.ts](../../src/utils/layout/basic-layout.ts)：确认 `baseY` 上移，`maxHeight` 仍为正数。
2. 静态检查 [useCanvasRenderer.ts](../../src/composables/useCanvasRenderer.ts)：确认索引仍绘制在 `y + 17`，因此新 baseline 会把索引带离底部。
3. 用户本地刷新页面后验证 bubble、insertion、quick、shell：
   - 初始态柱体不再压到底部边框。
   - 索引文字不再明显落在水平线下方。
   - 播放 compare/swap/highlight 时柱体底边稳定，整体位置保持中部偏下。
