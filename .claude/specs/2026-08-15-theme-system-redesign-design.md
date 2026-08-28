# 主题系统重设计：「双城」——暗/亮双精品

> 日期：2026-08-15
> 状态：设计已获批（四节分审通过），待用户审阅本文档
> 范围：主题数据层、Canvas 取色链路、切换交互、UI 组件层、排版、旧主题迁移与清理

---

## 1. 背景与问题诊断

项目是作品展示（portfolio）定位的排序算法可视化平台，第一印象的视觉品质是核心价值。当前主题系统存在三层问题：

### 1.1 审美问题

- **6 套主题 6 种人格**：dark/light/cyberpunk/ocean/sunset/forest 各说各话，没有统一设计语言。cyberpunk 是纯 RGB 高饱和堆砌，ocean/sunset/forest 状态色单色相不可区分，light 用 Bootstrap 色板。
- **主舞台不服从主题**：约 80% 视觉面积的 Canvas 柱子永远是同一套硬编码颜色（`TAG_STYLE_MAP`），主题只管页面背景——"画廊换了墙纸，展品却没换"。
- **每个状态的柱内数字都是黄色**（`text: "#ffd43b"`），六主题无一例外。
- **字体引用了从未加载的字体**：cyberpunk 主题引用 Orbitron/Fira Code，实际不存在，静默回退系统字体。
- 发光过重（`shadowBlur: 18`）且所有状态都发光，视觉焦点涣散。

### 1.2 架构缺陷（核心）

颜色在**构建期**被烘焙进 FrameState：

```
timeline-builders/* → getStyleFromStateTags() → TAG_STYLE_MAP（硬编码 hex）→ RenderableEntity.style.fill
                                                                    ↓
                                              FrameState 冻结 → 插值 → 渲染（主题只影响 background/grid/baseline）
```

后果：切主题永远不影响实体颜色；timeline 数据携带冗余颜色；主题里的 `stateStyles` 是从未被实体渲染消费的死配置（唯一消费者 `useTheme.getStyleForState` 也只查首个 tag 且无人调用其结果于实体）。

### 1.3 交互问题

- 切主题要经过：点按钮 → 开 425 行的模态（ThemeSelector.vue）→ 选主题 → 关模态，五步。
- 快捷键 Alt+T / Alt+Shift+T / Alt+R / Alt+1~6 全部服务于 6 主题轮换，改造后全部失效。

---

## 2. 目标与非目标

### 目标

1. 一套设计语言、两个精品主题：暗色「画廊」（默认）+ 亮色「画室」。
2. 切主题时 Canvas 实体色**即时**生效（含播放中），且 300ms 平滑换装。
3. Timeline 变纯数据：零主题依赖，切主题零重建。
4. 主题切换从五步变一步（header 内联日/月开关）。
5. Element Plus 组件视觉与自绘 UI 完全同源（同一套 token）。
6. 数值排版达到作品级（等宽数字、零抖动）。

### 非目标

- 不做多主题可扩展框架（2 个主题够用，YAGNI；结构上保留数组形态即可扩展）。
- 不做用户自定义色板/主题编辑器。
- 不改排序算法、动画时序、插值运动学（只改颜色解析这一层）。
- 不引入 UI 框架更换、不引入 CSS 框架（Tailwind 等）。

---

## 3. 审美北极星

**「射灯只打在展品上」**——画廊隐喻：

- 大面积基底是安静的低饱和石板灰（pending 占约 80% 柱子，是画布不是主角）；
- 只有活跃状态（comparing/swapping/pivot）发光，光是注意力，不是装饰；
- 每个状态色的色相彼此拉开（琥珀 45° / 珊瑚 0° / 翡翠 155° / 紫 265° / 冰青 190°），快速扫视即可分辨；
- UI 面板克制：纯色背景 + 1px 边框 + 极轻投影，不做玻璃拟态、大圆角、重阴影——UI 是展签，不是展品。

「统一」原则：UI / Canvas / 切换器 / 排版共享同一 token 体系，主题是同一系统的明暗两个变体，不是六张拼贴。

---

## 4. 视觉语言

### 4.1 暗色「画廊」（默认主题 `dark`）

**Canvas 状态色板**（`canvas.states`，glow 为发光乘数 0~1，主题 `shadowBlur` 基数 9）：

| StateTag | fill | glow | 语义 |
|---|---|---|---|
| pending | `#3d4f66` | 0 | 石板灰基底 |
| heap-pending | `#2b3a52` | 0 | 堆区更深的基底 |
| comparing | `#f5c542` | 0.8 | 琥珀——正在比较 |
| swapping | `#ff5d5d` | 1.0 | 珊瑚——正在交换（最大发光） |
| sorted | `#3ecf8e` | 0 | 翡翠——已就位（不发光，安静） |
| pivot | `#b78cff` | 0.7 | 紫——基准元素 |
| latest | `#22d3ee` | 0 | 冰青——最近放置 |

- **stroke 退役**：柱子不描边，色块即身份（堆树节点同理，靠色块+文字）。
- **柱内数字**：统一 `canvas.text = #9aa4b5`，不随状态变色。

**Scene 色**：background `#0b0e14`、backgroundSecondary `#11151d`、grid（点阵圆点半径 ~1px）`rgba(255,255,255,0.045)`、gridSpacing `24`、baseline `rgba(255,255,255,0.14)`、shadowBlur `9`。

**UI token**（CSS 变量）：`--bg-1 #0b0e14`（页面）/`--bg-2 #11151d`（面板）/`--bg-3 #171c26`（悬浮层）；`--border rgba(255,255,255,0.08)`；`--text #e8ecf3` / `--text-secondary #9aa4b5` / `--text-muted #5c6675`；`--accent #89b4fa`。

### 4.2 亮色「画室」（主题 `light`）

**Canvas 状态色板**（无发光，`shadowBlur: 0`）：

| StateTag | fill | 语义 |
|---|---|---|
| pending | `#a8b3c4` | 灰蓝基底 |
| heap-pending | `#94a1b5` | 稍深基底 |
| comparing | `#d97706` | 琥珀 |
| swapping | `#dc2626` | 红 |
| sorted | `#059669` | 绿 |
| pivot | `#7c3aed` | 紫 |
| latest | `#0891b2` | 青 |

柱内数字 `canvas.text = #5a5f6b`。

**Scene 色**：background `#fafaf7`（暖纸）、backgroundSecondary `#f2f1ec`、grid `rgba(28,30,36,0.05)`、baseline `rgba(28,30,36,0.25)`。

**UI token**：`--bg-1 #fafaf7` / `--bg-2 #ffffff`（面板，白卡）/`--bg-3 #ffffff`（悬浮层，靠投影区分）；`--border #e4e2da`；`--text #1c1e24` / `--text-secondary #5a5f6b` / `--text-muted #9aa0ab`；`--accent #3b6fd4`。亮色层次靠**投影**（极轻，`0 1px 3px rgba(28,30,36,0.08)`）而非深色背景。

### 4.3 色觉冗余通道

色相之外，glow（无→有→强）作为第二区分通道：红绿色弱用户面对 sorted（翡翠，无发光）与 swapping（珊瑚，最强发光）时，亮度梯度仍可分辨。此通道天然内建于上表，无需额外实现。

---

## 5. 架构设计

### 5.1 新数据流：渲染期取色

```
timeline-builders → 只产几何/状态标签（RenderableEntity.stateTags，不产颜色）
       ↓
FrameState（纯数据，零主题依赖）
       ↓
interpolateFrame（插值几何；stateTags 在 progress<0.5 取 from、≥0.5 取 to）
       ↓
useCanvasRenderer → resolveEntityStyle(entity.stateTags, palette) → ctx 颜色
                          ↑
themeStore.currentTheme.canvas（+ 色板混合器 300ms）
```

**关键修改点**：

1. **builders 停产颜色**：`TAG_STYLE_MAP`、`BAR_BASE_STYLE`、以及各 builder 内的 `MAIN_BASE_STYLE` / `BUFFER_BASE_STYLE` / `TREE_BASE_STYLE` / `bucketBaseStyle` 全部退役。实体 `style` 只保留非主题属性。
2. **interpolate-entity.ts**：`stateTags: progress < 0.5 ? from.stateTags : to.stateTags`（保持原 interpolateStyle 颜色 0.5 二值切换的设计语义——颜色突变配合状态节奏）。`style` 字段插值仅剩 `dashed`（二值）/`alpha`（线性）。
3. **RenderStyle 瘦身**（types/timeline.ts）：
   ```ts
   export interface RenderStyle {
     dashed?: boolean;
     alpha?: number;
   }
   ```
   `fill/stroke/text/glow` 从类型中删除（编译器保证无残留）。
4. **renderer 新增 `resolveEntityStyle(stateTags: StateTag[], palette: CanvasPalette)`**：按传入顺序迭代 tags，首个命中返回 `{ fill, glow }`；空 tags 回退 `palette.states.pending`。实现放 `src/utils/frame/style-utils.ts`（文件重写，保留 alpha 注入防御逻辑的等价物）。
5. **ghost 实体取色**：ghost 创建时不写颜色，复制源实体的 `stateTags`，渲染期与真实实体一视同仁。注：CLAUDE.md 经验 #3 禁止 ghost spread 源实体的**几何**属性（hidden 实体 width=0 会被继承）；`stateTags` 是非几何属性，不受该约束。
6. **overlays 语义 token 化**：`RenderableOverlay.style` 的颜色字段改为 token 引用（`accent` / `text` / `text-secondary` / `text-muted` / `border` / `sorted` / `swapping`），渲染期查主题。Overlay 类型独立定义，不与瘦身后的 RenderStyle 混用。

### 5.2 themes.ts 新结构

`src/data/themes.ts` 全量重写（483 行 → 2 主题），每主题三段：

```ts
interface ThemeDefinition {
  id: "dark" | "light";
  dark: boolean;                    // 元数据：消灭 3 处硬编码 ID 列表
  ui: {                             // → applyThemeToDOM 注入 CSS 变量
    bg1, bg2, bg3, border, text, textSecondary, textMuted, accent,
    shadow?: string                 // 亮色投影，暗色为 undefined
  };
  canvas: {                         // → 渲染期取色（参与 300ms 混合）
    background, backgroundSecondary, grid, gridSpacing, baseline,
    shadowBlur, text,               // 柱内数字色
    states: Record<StateTag, { fill: string; glow: number }>
  };
  typography: { labelFont, valueFont, monoFont };  // ctx.font 字符串
}
```

- **Element Plus 映射**：`applyThemeToDOM` 同时注入 `--el-color-primary: var(--accent)`、`--el-bg-color: var(--bg-1)`、`--el-border-color: var(--border)` 等映射（覆盖默认 EP 视觉的约 80%）。
- **旧过渡 hack 退役**：`themeStore.setTheme` 里 50ms setTimeout + `theme-transitioning` class 删除，改为直接切 id + UI 层 CSS transition（`background-color/border-color/color 0.3s`）+ Canvas 色板混合器，两侧同节奏。
- **系统偏好检测保留**：`initialize()` 无存量偏好时读 `prefers-color-scheme`，light → `light`，否则默认 `dark`。

### 5.3 色板混合器（300ms 换装）

- 纯函数 `mixCanvasPalette(from, to, t)`：hex→rgb 每通道 lerp→hex，覆盖 `canvas` 段全部颜色（含 states 各 fill；glow 数值直接 lerp）。
- renderer 侧持有 `{ from, to, startTime }`，主题变更时记录；每帧取 `min(1, elapsed/300)` 计算 palette 后绘制；`t=1` 后驻留新 palette。
- 结果：showcase 演示中切主题，柱子颜色渐变换装而非跳变；播放中切换同样生效（palette 是每帧绘制输入，非烘焙数据）。

### 5.4 localStorage 迁移

存量 key `sort-visualizer-theme` 中的旧 ID 一次性映射后**回写**：

| 旧值 | 新值 |
|---|---|
| `dark` / `cyberpunk` / `ocean` / `sunset` / `forest` | `dark` |
| `light` | `light` |
| 其他/缺失 | 走系统偏好检测 |

迁移在 `initialize()` 内完成，用户无感知。

### 5.5 Element Plus 三层接管

1. **变量映射层**（5.2 已述）：`--el-*` 指向项目 token。
2. **组件微调层**：新建 `src/styles/element-overrides.scss`——slider 轨道/把手、select 下拉面板、dialog 圆角与投影按 token 重调。
3. **克制原则**：EP 面板 = `--bg-1` + 1px `--border` + 极轻投影，与自绘面板同构（射灯原则在 UI 层的延伸）。

---

## 6. 切换交互与 UI 层

### 6.1 切换器

- **ThemeSelector.vue（425 行模态）整体删除**。
- **ThemeSwitcher.vue 重写**：header 右侧约 40px 圆角按钮，太阳⇄月亮图标以旋转+缩放过渡切换；点击即在 `dark`/`light` 间切换并触发 300ms 全应用换装。图标用项目已有依赖 `@element-plus/icons-vue`（Sunny/Moon）。
- `themeStore` 接口瘦身：`nextTheme` / `previousTheme` / `resetToDefault` / `exportThemeConfig` / `importThemeConfig` 退役，保留 `setTheme` / `toggleDarkMode`（内部改为 `!dark` 取反）。

### 6.2 快捷键精简（useKeyboardShortcuts.ts）

| 快捷键 | 处置 |
|---|---|
| Alt+D（切换深浅） | **保留** |
| Alt+T / Alt+Shift+T（上/下一主题） | 退役 |
| Alt+R（重置默认主题） | 退役 |
| Alt+1~6（直选主题） | 退役 |

`SHORTCUT_HELP` 同步精简。此文件与 `themeStore.toggleDarkMode` 中的主题 ID 硬编码数组一并清除（改用 `theme.dark` 元数据）。

### 6.3 组件改造清单

| 组件 | 改动 |
|---|---|
| App.vue | 背景从 linear-gradient 线网格改为 token 驱动点阵（CSS `radial-gradient` 平铺，24px 间距与 Canvas gridSpacing 一致）；header 排版收紧；标题旁加等宽小写 eyebrow 标签 |
| ControlPanel.vue | 走 EP 三层接管；统计数字 `font-variant-numeric: tabular-nums`；间距走统一尺度 |
| ThemeSwitcher.vue | 重写为 6.1 的内联开关 |
| ThemeSelector.vue | **删除** |
| KeyboardShortcutsHelp.vue | 精简至实际快捷键集 |
| CompareView / CompareSlot | 走同一 token，无特化逻辑 |
| SortBarCanvas × 4 | 哑壳不动（仅继承 renderer 取色变化） |
| 算法视图 × 7 + PlaybackButton | stats 数字 tabular-nums；状态徽标/文案色改用语义 token（accent/sorted/swapping） |

### 6.4 排版

- **JetBrains Mono 自托管**：woff2（Regular + Medium 两字重，约 100KB 总量）放 `src/assets/fonts/`，`@font-face` + `font-display: swap`。用于：统计数字、进度数值、Canvas 柱内数字（`typography.monoFont` / `valueFont` 引入它）。
- **中文**：系统栈（`PingFang SC` / `Microsoft YaHei`）；**拉丁 UI**：`system-ui` 起底的系统栈。`ui` 段提供 `fontFamily` / `fontFamilyMono` 两个 token。
- **制度化教训**：不存在的字体不写进字体栈——themes.ts 的 typography 字符串只允许引用自托管字体或系统字体（Orbitron 教训写入本 spec 与代码注释）。

---

## 7. 实施与验收

### 7.1 实施顺序（四阶段，每阶段独立可验证）

| 阶段 | 内容 | 依赖 |
|---|---|---|
| **A. 设计令牌层** | themes.ts 重写（2 主题 × 三段）、types/theme.ts 重写、themeStore 适配（含 CSS 变量注入、`--el-*` 映射、迁移、接口瘦身）、useTheme 清理 | 无 |
| **B. 取色链路** | style-utils.ts 重写（TAG_STYLE_MAP 退役、resolveEntityStyle）、4 个 builder 停产颜色、interpolate-entity 改 stateTags 切换、RenderStyle/Overlay 类型瘦身、useCanvasRenderer 接 palette + 混合器、overlays token 化 | A |
| **C. UI 层** | ThemeSwitcher 重写、ThemeSelector 删除、快捷键精简、6.3 组件清单、element-overrides.scss、字体自托管 | A（CSS 变量） |
| **D. 清理与测试** | 全局残留扫描、style-utils.test.ts 重写、混合器/迁移新测试、7 算法回归 | B、C |

### 7.2 删除清单

- 文件：`ThemeSelector.vue`；cyberpunk 等 4 主题全部数据。
- 常量/函数：`TAG_STYLE_MAP`、`BAR_BASE_STYLE`、builders 内 `*_BASE_STYLE` / `bucketBaseStyle`、`useTheme.getStyleForState` / `getBaseStyle`、`isDarkTheme` 硬编码数组、themeStore 的 `nextTheme` / `previousTheme` / `resetToDefault` / `exportThemeConfig` / `importThemeConfig`、`theme-transitioning` 过渡 hack。
- 类型：`ThemeId` 收窄为 `"dark" | "light"`；`ColorPalette` / `StateStyleMapping` 随新结构重写。

### 7.3 测试策略

- **重写** `test/unit/utils/frame/style-utils.test.ts`：旧断言（`#4a9eff`、`#ffcc00` 等）全部失效，改为断言 `resolveEntityStyle` 的 tag 优先级、空 tags 回退、新 `interpolateStyle`（dashed/alpha）行为。
- **新增**：`mixCanvasPalette` 测试（t=0 旧色 / t=1 新色 / t=0.5 按比例）；localStorage 迁移映射测试（含非法值回退系统偏好）。
- **回归（CLAUDE.md 经验要求）**：interpolate-entity 是全部 7 算法动画的公共路径——7 算法 × 2 主题逐一目检：实体不闪现、颜色随状态切换、ghost 正常、hidden 实体不显现。
- 爆炸半径已核实：仅 style-utils.test.ts 一处断言颜色，其余测试不涉主题。

### 7.4 验收标准

**功能**：
- 切主题时 Canvas 实体色即时变化（含播放中）——核心缺陷修复的验证动作；
- 7 算法 × 2 主题全流程动画无回归；对比模式双画布换装一致；
- 刷新后主题保持（localStorage 迁移正确）；系统偏好检测工作。

**审美**：
- 暗色为默认第一印象；5 种活跃状态色快速扫视可分辨；
- 统计数字滚动零抖动（tabular-nums）；300ms 换装顺滑无闪烁、无中间跳变。

**代码**：
- 全局 rg 无 `TAG_STYLE_MAP` / `BAR_BASE_STYLE` / `Orbitron` / `cyberpunk` 残留；
- 主题 ID 字符串仅在 themes.ts 出现一次；
- `npm run type-check` + `npm run test:run` 通过（由用户执行）。

---

## 8. 风险与缓解

| 风险 | 缓解 |
|---|---|
| interpolate-entity 改动影响全部 7 算法动画 | 阶段 B 完成后立即全量目检回归（7 算法 × 2 主题），不等阶段 D |
| RenderStyle 删字段引发大量编译错误 | 这是特性不是风险：编译器逐个暴露残留烘焙点，逐一改为 stateTags 方案 |
| EP 组件映射覆盖不全（非 primary 色的按钮/警示色） | element-overrides.scss 兜底；验收时逐面板目检 |
| JetBrains Mono woff2 体积 | 仅两字重 + `font-display: swap`；约 100KB 可接受，不引入 variable font 以外的复杂度 |
| 旧主题存量用户（localStorage） | 5.4 迁移表一次性回写，无感知 |
| ghost/hidden 实体在取色改造后意外显现 | 保持 CLAUDE.md 经验 #1/#2/#3 的防御（width=0、from/to 双帧隐藏、ghost 不 spread 几何），回归清单显式包含 |
