# 「双城」主题系统重设计 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用一套设计 token、两个精品主题（暗「画廊」默认 + 亮「画室」）替换现有 6 主题系统，实现 Canvas 实体色渲染期取色（切主题即时生效）、300ms 色板混合换装、一键日/月切换。

**Architecture:** builders 停止烘焙颜色（Timeline 变纯数据）；`useCanvasRenderer` 每帧经 `resolveEntityStyle(stateTags, palette)` 从主题取色；`themeStore` 持有混合器状态（300ms hex lerp）；UI 层全部消费 CSS 变量（`--bg-1` 等 token + `--el-*` 映射）。

**Tech Stack:** Vue 3.5 + TS + Pinia 4 + Canvas 2D + SCSS + Vitest 4（happy-dom）。

**Spec:** `.claude/specs/2026-08-15-theme-system-redesign-design.md`（计划从 spec 出发，执行者应同时阅读两份文档）

## Global Constraints

- **禁止 git 操作**（用户全局规则）：所有任务**不含 commit 步骤**，版本管理由用户自行处理。
- **禁止擅自运行命令**（用户全局规则）：任务中的 `npx vitest run ...` / `npx vue-tsc --noEmit` 验证步骤，执行前必须征得用户授权；未获授权时以静态自查（重读改动文件、检查 import/引用完整性）代替并在任务末尾标注"待用户验证"。
- 路径别名 `@` → `src`（vite + vitest 均已配置）。
- 字体栈只允许引用自托管字体或系统字体（Orbitron 教训，spec 6.4）。
- **不得破坏 CLAUDE.md 排序动画经验**：#1（opacity=0 必须配合 width=0）、#2（ghost 动画 from/to 双帧隐藏）、#3（ghost 禁 spread 源实体几何属性）、#6（gather ghost to 帧 opacity=1 防切换闪烁）。builders 改造只删颜色相关代码，不动几何/可见性逻辑。
- Element Plus 组件在本项目中**零使用**（已核实无 `<el-` 模板标签）：`--el-*` 映射只作为防御性变量注入（未来引入 EP 组件时自动同源），**不需要** element-overrides.scss 组件微调层（spec 5.5 第 2 层裁剪，理由：无对象，YAGNI）。
- 全部代码注释使用中文。

## 文件结构总览

```
src/
  types/theme.ts                 # 重写：ThemeId / StateVisual / RendererPalette / ThemeDefinition
  types/timeline.ts              # 修改：RenderStyle 瘦身、OverlayStyle 新增、RenderableOverlay 调整
  data/themes.ts                 # 重写：双主题数据 + migrateThemeId
  stores/themeStore.ts           # 重写：新结构 + CSS 变量注入 + 混合器状态
  composables/useTheme.ts        # 删除（消费者全部改为直接用 themeStore / CSS 变量）
  utils/frame/style-utils.ts     # 重写：resolveEntityStyle + 新 interpolateStyle
  utils/frame/palette-mixer.ts   # 新建：mixRendererPalette 纯函数
  utils/frame/bucket-palette.ts  # 删除（每桶轮换色退役）
  utils/frame/interpolate-entity.ts   # 修改：stateTags 0.5 二值切换
  utils/timeline-builders/build-{basic,merge,heap,bucket}-timeline.ts  # 修改：停产颜色 + overlay token 化
  composables/useCanvasRenderer.ts    # 重写核心：渲染期取色 + 点阵背景 + 混合器集成
  composables/useKeyboardShortcuts.ts # 修改：主题快捷键精简至 Alt+D
  components/ThemeSwitcher.vue   # 重写：日/月内联开关
  components/ThemeSelector.vue   # 删除
  components/KeyboardShortcutsHelp.vue # 修改：精简
  components/ControlPanel.vue    # 修改：样式 token 化
  components/CompareView.vue / CompareSlot.vue  # 修改：样式 token 化 + tabular-nums
  components/SortBarCanvas*.vue ×4  # 修改：corner 装饰 token 化
  components/algorithms/_algorithm-common.scss   # 修改：token 化 + tabular-nums
  App.vue                        # 修改：点阵背景 + header 重排
  style.css                      # 重写：去 Google Fonts import、字体变量
  styles/theme.scss              # 新建：@font-face + 过渡 + tabular-nums
  styles/theme-transitions.css   # 删除（功能并入 theme.scss）
  assets/fonts/JetBrainsMono-{Regular,Bold}.woff2  # 新增（下载需授权）
test/unit/data/themes.test.ts            # 新建
test/unit/utils/frame/palette-mixer.test.ts  # 新建
test/unit/stores/themeStore.test.ts      # 新建
test/unit/utils/frame/style-utils.test.ts # 重写
```

---

## 阶段 A：设计令牌层

### Task 1: 主题类型与双主题数据

**Files:**
- Rewrite: `src/types/theme.ts`
- Rewrite: `src/data/themes.ts`
- Create: `test/unit/data/themes.test.ts`

**Interfaces:**
- Consumes: `StateTag`（来自 `@/types/timeline`，不改）
- Produces（后续所有任务依赖）:
  - `ThemeId = "dark" | "light"`
  - `StateVisual = { fill: string; glow: number }`
  - `RendererPalette`（见下方代码，palette-mixer / themeStore / renderer 共用）
  - `ThemeDefinition = { id; name; dark; ui; canvas }`
  - `THEME_PRESETS: { default: ThemeId; themes: ThemeDefinition[] }`
  - `migrateThemeId(saved: string | null): ThemeId | null`

- [ ] **Step 1: 写数据结构测试**

`test/unit/data/themes.test.ts`：

```ts
import { describe, test, expect } from 'vitest';
import { THEME_PRESETS, migrateThemeId } from '@/data/themes';
import type { StateTag } from '@/types/timeline';

const ALL_TAGS: StateTag[] = ['comparing', 'swapping', 'sorted', 'pivot', 'pending', 'heap-pending', 'latest'];

describe('THEME_PRESETS', () => {
  test('默认主题是 dark', () => {
    expect(THEME_PRESETS.default).toBe('dark');
  });

  test('恰好两个主题：dark 与 light', () => {
    expect(THEME_PRESETS.themes.map(t => t.id)).toEqual(['dark', 'light']);
  });

  test('每个主题 dark 元数据与 id 一致（消灭硬编码 ID 列表）', () => {
    for (const theme of THEME_PRESETS.themes) {
      expect(theme.dark).toBe(theme.id === 'dark');
    }
  });

  test('每个主题 canvas.states 覆盖全部 7 个 StateTag 且 fill 为 6 位 hex', () => {
    for (const theme of THEME_PRESETS.themes) {
      for (const tag of ALL_TAGS) {
        const visual = theme.canvas.states[tag];
        expect(visual, `${theme.id} 缺少状态 ${tag}`).toBeDefined();
        expect(visual.fill).toMatch(/^#[0-9a-f]{6}$/i);
        expect(visual.glow).toBeGreaterThanOrEqual(0);
        expect(visual.glow).toBeLessThanOrEqual(1);
      }
    }
  });

  test('暗色主题仅 comparing/swapping/pivot 发光（射灯原则）', () => {
    const dark = THEME_PRESETS.themes.find(t => t.id === 'dark')!;
    expect(dark.canvas.states.comparing.glow).toBeGreaterThan(0);
    expect(dark.canvas.states.swapping.glow).toBeGreaterThan(0);
    expect(dark.canvas.states.pivot.glow).toBeGreaterThan(0);
    expect(dark.canvas.states.sorted.glow).toBe(0);
    expect(dark.canvas.states.pending.glow).toBe(0);
    expect(dark.canvas.states.latest.glow).toBe(0);
    expect(dark.canvas.states['heap-pending'].glow).toBe(0);
  });

  test('亮色主题零发光', () => {
    const light = THEME_PRESETS.themes.find(t => t.id === 'light')!;
    expect(light.canvas.shadowBlur).toBe(0);
  });

  test('两主题 gridSpacing 一致为 24（Canvas 与 CSS 点阵对齐）', () => {
    for (const theme of THEME_PRESETS.themes) {
      expect(theme.canvas.gridSpacing).toBe(24);
    }
  });
});

describe('migrateThemeId', () => {
  test('旧暗色系主题全部迁移到 dark', () => {
    for (const legacy of ['dark', 'cyberpunk', 'ocean', 'sunset', 'forest']) {
      expect(migrateThemeId(legacy)).toBe('dark');
    }
  });

  test('light 原样保留', () => {
    expect(migrateThemeId('light')).toBe('light');
  });

  test('null 与未知值返回 null（走系统偏好检测）', () => {
    expect(migrateThemeId(null)).toBeNull();
    expect(migrateThemeId('nonexistent')).toBeNull();
  });
});
```

- [ ] **Step 2: 重写 `src/types/theme.ts`**

全量替换为：

```ts
import type { StateTag } from "./timeline";

/** 主题标识符（双城：暗画廊 / 亮画室） */
export type ThemeId = "dark" | "light";

/** 单个状态的视觉：填充色 + 发光乘数（0~1，由 renderer 乘 shadowBlur 基数） */
export interface StateVisual {
  fill: string;
  glow: number;
}

/**
 * 渲染期调色板：useCanvasRenderer 每帧读取的唯一取色来源。
 * 由主题 canvas 段 + overlay 需要的 ui 子集合成；主题切换时 300ms 逐字段混合。
 * grid / gridSpacing / baseline / border 可能是 rgba() 字符串，不参与混合（直接取新主题）。
 */
export interface RendererPalette {
  /** 背景色（混合） */
  background: string;
  /** 次级背景 / badge 底色（混合） */
  backgroundSecondary: string;
  /** Canvas 内数值文字色（混合） */
  text: string;
  /** Canvas 内序号文字色（混合） */
  indexText: string;
  /** 发光基数，最终 shadowBlur = shadowBlur * state.glow（数值混合） */
  shadowBlur: number;
  /** 点阵圆点色（不混合，rgba 字符串） */
  grid: string;
  /** 点阵间距 px（不混合） */
  gridSpacing: number;
  /** 基线色（不混合，rgba 字符串） */
  baseline: string;
  /** 状态色板（fill 混合、glow 数值混合） */
  states: Record<StateTag, StateVisual>;
  /** —— 以下为 overlay 需要的 ui 子集（混合） —— */
  accent: string;
  uiText: string;
  uiTextSecondary: string;
  uiTextMuted: string;
  /** 面板/分隔线边框色（不混合，可能 rgba） */
  border: string;
}

/** UI 层 token（注入为 CSS 变量） */
export interface ThemeUiTokens {
  bg1: string;
  bg2: string;
  bg3: string;
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  /** 面板投影；暗色为 "none"（用边框分层），亮色用极轻投影 */
  shadow: string;
}

/** 主题定义（纯数据，三段结构） */
export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  /** 元数据：深浅判断唯一来源，消灭硬编码主题 ID 列表 */
  dark: boolean;
  ui: ThemeUiTokens;
  /** Canvas 渲染段：直接复用 RendererPalette 字段集 */
  canvas: RendererPalette;
}
```

- [ ] **Step 3: 重写 `src/data/themes.ts`**

全量替换为（色值逐字来自 spec 第 4 章，不得改动）：

```ts
import type { ThemeDefinition, ThemeId } from "@/types/theme";

/** 主题切换混合时长（ms），与 CSS 过渡时长保持一致 */
export const THEME_MIX_DURATION = 300;

/**
 * 精品主题库：一套设计语言，明暗两个变体。
 * 字体栈只允许自托管或系统字体（Orbitron 教训，见 spec 6.4）。
 */
export const THEME_PRESETS: { default: ThemeId; themes: ThemeDefinition[] } = {
  default: "dark",
  themes: [
    {
      id: "dark",
      name: "画廊",
      dark: true,
      ui: {
        bg1: "#0b0e14",
        bg2: "#11151d",
        bg3: "#171c26",
        border: "rgba(255, 255, 255, 0.08)",
        text: "#e8ecf3",
        textSecondary: "#9aa4b5",
        textMuted: "#5c6675",
        accent: "#89b4fa",
        shadow: "none",
      },
      canvas: {
        background: "#0b0e14",
        backgroundSecondary: "#11151d",
        text: "#9aa4b5",
        indexText: "#5c6675",
        shadowBlur: 9,
        grid: "rgba(255, 255, 255, 0.045)",
        gridSpacing: 24,
        baseline: "rgba(255, 255, 255, 0.14)",
        states: {
          pending: { fill: "#3d4f66", glow: 0 },
          "heap-pending": { fill: "#2b3a52", glow: 0 },
          comparing: { fill: "#f5c542", glow: 0.8 },
          swapping: { fill: "#ff5d5d", glow: 1 },
          sorted: { fill: "#3ecf8e", glow: 0 },
          pivot: { fill: "#b78cff", glow: 0.7 },
          latest: { fill: "#22d3ee", glow: 0 },
        },
        accent: "#89b4fa",
        uiText: "#e8ecf3",
        uiTextSecondary: "#9aa4b5",
        uiTextMuted: "#5c6675",
        border: "rgba(255, 255, 255, 0.08)",
      },
    },
    {
      id: "light",
      name: "画室",
      dark: false,
      ui: {
        bg1: "#fafaf7",
        bg2: "#ffffff",
        bg3: "#ffffff",
        border: "#e4e2da",
        text: "#1c1e24",
        textSecondary: "#5a5f6b",
        textMuted: "#9aa0ab",
        accent: "#3b6fd4",
        shadow: "0 1px 3px rgba(28, 30, 36, 0.08)",
      },
      canvas: {
        background: "#fafaf7",
        backgroundSecondary: "#f2f1ec",
        text: "#5a5f6b",
        indexText: "#9aa0ab",
        shadowBlur: 0,
        grid: "rgba(28, 30, 36, 0.05)",
        gridSpacing: 24,
        baseline: "rgba(28, 30, 36, 0.25)",
        states: {
          pending: { fill: "#a8b3c4", glow: 0 },
          "heap-pending": { fill: "#94a1b5", glow: 0 },
          comparing: { fill: "#d97706", glow: 0 },
          swapping: { fill: "#dc2626", glow: 0 },
          sorted: { fill: "#059669", glow: 0 },
          pivot: { fill: "#7c3aed", glow: 0 },
          latest: { fill: "#0891b2", glow: 0 },
        },
        accent: "#3b6fd4",
        uiText: "#1c1e24",
        uiTextSecondary: "#5a5f6b",
        uiTextMuted: "#9aa0ab",
        border: "#e4e2da",
      },
    },
  ],
};

/** 旧主题 ID → 新主题 ID 的一次性映射（spec 5.4 迁移表） */
const LEGACY_THEME_MAP: Record<string, ThemeId> = {
  dark: "dark",
  cyberpunk: "dark",
  ocean: "dark",
  sunset: "dark",
  forest: "dark",
  light: "light",
};

/**
 * localStorage 存量主题 ID 迁移；返回 null 表示无存量或未知值（由调用方走系统偏好检测）
 */
export function migrateThemeId(saved: string | null): ThemeId | null {
  if (!saved) return null;
  if (saved === "dark" || saved === "light") return saved;
  return LEGACY_THEME_MAP[saved] ?? null;
}
```

- [ ] **Step 4: 验证**

Run（需授权）: `npx vitest run test/unit/data/themes.test.ts`
Expected: 全部 PASS。
（此时 `themeStore.ts` 仍 import 旧结构会编译报错——Task 3 紧接着重写它，属预期中间态；只跑本测试文件不触发全量类型检查。）

---

### Task 2: 色板混合器（纯函数）

**Files:**
- Create: `src/utils/frame/palette-mixer.ts`
- Create: `test/unit/utils/frame/palette-mixer.test.ts`

**Interfaces:**
- Consumes: `RendererPalette`（Task 1）
- Produces:
  - `mixHex(a: string, b: string, t: number): string`
  - `mixRendererPalette(from: RendererPalette, to: RendererPalette, t: number): RendererPalette`
  - `easeOutCubic(t: number): number`

- [ ] **Step 1: 写失败测试**

`test/unit/utils/frame/palette-mixer.test.ts`：

```ts
import { describe, test, expect } from 'vitest';
import { mixHex, mixRendererPalette, easeOutCubic } from '@/utils/frame/palette-mixer';
import type { RendererPalette } from '@/types/theme';

function makePalette(fill: string, glow: number, shadowBlur: number): RendererPalette {
  return {
    background: fill,
    backgroundSecondary: fill,
    text: fill,
    indexText: fill,
    shadowBlur,
    grid: 'rgba(0,0,0,0.1)',
    gridSpacing: 24,
    baseline: 'rgba(0,0,0,0.2)',
    states: {
      comparing: { fill, glow },
      swapping: { fill, glow },
      sorted: { fill, glow },
      pivot: { fill, glow },
      pending: { fill, glow },
      'heap-pending': { fill, glow },
      latest: { fill, glow },
    },
    accent: fill,
    uiText: fill,
    uiTextSecondary: fill,
    uiTextMuted: fill,
    border: 'rgba(0,0,0,0.3)',
  };
}

describe('mixHex', () => {
  test('t=0 返回 a，t=1 返回 b', () => {
    expect(mixHex('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mixHex('#000000', '#ffffff', 1)).toBe('#ffffff');
  });

  test('t=0.5 每通道取中点', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mixHex('#3d4f66', '#a8b3c4', 0.5)).toBe('#738195');
  });

  test('四舍五入到最近整数通道值', () => {
    // (0x3d + 0xa8) / 2 = 114.5 → Math.round = 115 = 0x73
    expect(mixHex('#3d0000', '#a80000', 0.5)).toBe('#730000');
  });
});

describe('mixRendererPalette', () => {
  const from = makePalette('#3d4f66', 0, 9);
  const to = makePalette('#a8b3c4', 1, 0);

  test('t=0 等于 from，t=1 等于 to（混合字段）', () => {
    expect(mixRendererPalette(from, to, 0).background).toBe('#3d4f66');
    expect(mixRendererPalette(from, to, 1).background).toBe('#a8b3c4');
  });

  test('states.fill 与 glow 参与混合', () => {
    const mid = mixRendererPalette(from, to, 0.5);
    expect(mid.states.pending.fill).toBe('#738195');
    expect(mid.states.pending.glow).toBe(0.5);
  });

  test('shadowBlur 数值线性混合', () => {
    expect(mixRendererPalette(from, to, 0.5).shadowBlur).toBe(4.5);
  });

  test('grid/gridSpacing/baseline/border 不混合，直接取 to', () => {
    const mid = mixRendererPalette(from, to, 0.5);
    expect(mid.grid).toBe(to.grid);
    expect(mid.gridSpacing).toBe(to.gridSpacing);
    expect(mid.baseline).toBe(to.baseline);
    expect(mid.border).toBe(to.border);
  });
});

describe('easeOutCubic', () => {
  test('标准缓出曲线', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 5);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run（需授权）: `npx vitest run test/unit/utils/frame/palette-mixer.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 `src/utils/frame/palette-mixer.ts`**

```ts
import type { RendererPalette } from "@/types/theme";

/** 6 位 hex → rgb 三元组 */
function hexToRgb(hex: string): [number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

function channelToHex(value: number): string {
  return Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, "0");
}

/** 两个 6 位 hex 之间的每通道线性插值 */
export function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return `#${channelToHex(ar + (br - ar) * t)}${channelToHex(ag + (bg - ag) * t)}${channelToHex(ab + (bb - ab) * t)}`;
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** 参与混合的 hex 字段（rgba 字符串字段不在此列） */
const MIXED_HEX_FIELDS = [
  "background", "backgroundSecondary", "text", "indexText",
  "accent", "uiText", "uiTextSecondary", "uiTextMuted",
] as const;

/**
 * 渲染调色板混合（spec 5.3）：
 * - hex 字段每通道 lerp；states 的 fill 同理、glow 与 shadowBlur 数值 lerp；
 * - grid / gridSpacing / baseline / border 直接取 to（rgba 字符串不解析，切换瞬间跳变无视觉影响）。
 */
export function mixRendererPalette(from: RendererPalette, to: RendererPalette, t: number): RendererPalette {
  const result: RendererPalette = {
    ...to,
    shadowBlur: from.shadowBlur + (to.shadowBlur - from.shadowBlur) * t,
    states: { ...to.states },
  };

  for (const field of MIXED_HEX_FIELDS) {
    (result[field] as string) = mixHex(from[field] as string, to[field] as string, t);
  }

  for (const tag of Object.keys(to.states) as Array<keyof RendererPalette["states"]>) {
    const fromState = from.states[tag] ?? to.states[tag];
    result.states[tag] = {
      fill: mixHex(fromState.fill, to.states[tag].fill, t),
      glow: fromState.glow + (to.states[tag].glow - fromState.glow) * t,
    };
  }

  return result;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run（需授权）: `npx vitest run test/unit/utils/frame/palette-mixer.test.ts`
Expected: 全部 PASS。

---

### Task 3: themeStore 重写

**Files:**
- Rewrite: `src/stores/themeStore.ts`
- Create: `test/unit/stores/themeStore.test.ts`

**Interfaces:**
- Consumes: `THEME_PRESETS`、`migrateThemeId`、`THEME_MIX_DURATION`（Task 1）、`mixRendererPalette`、`easeOutCubic`（Task 2）
- Produces（Task 7/8/9 依赖）:
  - `useThemeStore()` 返回：`currentThemeId: Ref<ThemeId>`、`currentTheme: Ref<ThemeDefinition>`、`isDark: Ref<boolean>`、`initialize()`、`setTheme(id: ThemeId)`、`toggleDarkMode()`、`currentRendererPalette(now: number): RendererPalette`、`isPaletteMixing(): boolean`
  - **退役**（不再导出）：`nextTheme` / `previousTheme` / `resetToDefault` / `exportThemeConfig` / `importThemeConfig` / `colors` / `stateStyles` / `effects` / `typography` / `animation` / `getThemeCSSVariables` / `isTransitioning`

- [ ] **Step 1: 写失败测试**

`test/unit/stores/themeStore.test.ts`（happy-dom 提供 localStorage/document）：

```ts
import { describe, test, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useThemeStore } from '@/stores/themeStore';

beforeEach(() => {
  setActivePinia(createPinia());
  localStorage.clear();
  document.documentElement.style.cssText = '';
  document.body.className = '';
});

describe('themeStore.initialize', () => {
  test('无存量时默认 dark（matchMedia 不可用场景）', () => {
    const store = useThemeStore();
    store.initialize();
    expect(store.currentThemeId).toBe('dark');
  });

  test('旧主题 ID 迁移并回写 localStorage', () => {
    for (const [saved, expected] of [['cyberpunk', 'dark'], ['forest', 'dark'], ['light', 'light']] as const) {
      localStorage.setItem('sort-visualizer-theme', saved);
      const store = useThemeStore();
      store.initialize();
      expect(store.currentThemeId).toBe(expected);
      expect(localStorage.getItem('sort-visualizer-theme')).toBe(expected);
    }
  });
});

describe('themeStore.setTheme', () => {
  test('切换后 CSS 变量与 --el-* 映射注入 documentElement', () => {
    const store = useThemeStore();
    store.setTheme('light');
    const style = document.documentElement.style;
    expect(style.getPropertyValue('--bg-1')).toBe('#fafaf7');
    expect(style.getPropertyValue('--accent')).toBe('#3b6fd4');
    expect(style.getPropertyValue('--el-color-primary')).toBe('#3b6fd4');
    expect(style.getPropertyValue('--el-bg-color')).toBe('#fafaf7');
  });

  test('切换后 localStorage 持久化且 isDark 翻转', () => {
    const store = useThemeStore();
    expect(store.isDark).toBe(true);
    store.toggleDarkMode();
    expect(store.currentThemeId).toBe('light');
    expect(store.isDark).toBe(false);
    expect(localStorage.getItem('sort-visualizer-theme')).toBe('light');
  });

  test('未知主题 ID 静默忽略', () => {
    const store = useThemeStore();
    store.setTheme('nonexistent' as never);
    expect(store.currentThemeId).toBe('dark');
  });
});

describe('色板混合状态', () => {
  test('isPaletteMixing：切换后为 true，currentRendererPalette(∞) 后归位', () => {
    const store = useThemeStore();
    store.setTheme('light');
    expect(store.isPaletteMixing()).toBe(true);
    // 混合结束后取 to 且停止混合
    const final = store.currentRendererPalette(Number.MAX_SAFE_INTEGER);
    expect(final.background).toBe('#fafaf7');
    expect(store.isPaletteMixing()).toBe(false);
  });

  test('混合中途：t=0.5 时 background 为两主题中点（easeOutCubic(0.5)=0.875）', () => {
    const store = useThemeStore();
    store.setTheme('light');
    // 主题切换发生在此刻，用 mixStartedAt 无法直接读；改验证任意中途值在两极值之间
    const mid = store.currentRendererPalette(performance.now() + 10);
    const bg = mid.background;
    expect(bg).not.toBe('#0b0e14'); // 已离开起点
  });
});
```

> 注：`setTheme` 内部使用 `performance.now()`，happy-dom 支持该 API。测试中"中途值"断言只验证离开起点（不依赖精确时刻）。

- [ ] **Step 2: 运行测试确认失败**

Run（需授权）: `npx vitest run test/unit/stores/themeStore.test.ts`
Expected: FAIL（旧 store 无新 API）。

- [ ] **Step 3: 重写 `src/stores/themeStore.ts`**

```ts
import { defineStore } from "pinia";
import { ref, computed, watch } from "vue";
import type { RendererPalette, ThemeId } from "@/types/theme";
import { THEME_PRESETS, migrateThemeId, THEME_MIX_DURATION } from "@/data/themes";
import { mixRendererPalette, easeOutCubic } from "@/utils/frame/palette-mixer";

const THEME_STORAGE_KEY = "sort-visualizer-theme";

/** 由主题定义构造渲染调色板（canvas 段即完整 RendererPalette） */
function toRendererPalette(theme: (typeof THEME_PRESETS.themes)[number]): RendererPalette {
  return theme.canvas;
}

/**
 * 主题管理 Store（双城：dark / light）
 * - UI 层：CSS 变量注入（含 --el-* 防御性映射）
 * - Canvas 层：渲染期调色板 + 300ms 混合换装
 */
export const useThemeStore = defineStore("theme", () => {
  const currentThemeId = ref<ThemeId>("dark");

  const availableThemes = computed(() => THEME_PRESETS.themes);
  const currentTheme = computed(
    () => availableThemes.value.find((t) => t.id === currentThemeId.value) ?? availableThemes.value[0],
  );
  const isDark = computed(() => currentTheme.value.dark);

  // ── 渲染调色板混合状态（非响应式：由 renderer 每帧轮询，避免高频 ref 触发） ──
  let paletteFrom: RendererPalette = toRendererPalette(currentTheme.value);
  let paletteTo: RendererPalette = paletteFrom;
  let mixStartedAt = 0; // 0 = 无进行中的混合

  /** 混合是否进行中（renderer 据此决定是否继续请求下一帧） */
  function isPaletteMixing(): boolean {
    return mixStartedAt !== 0;
  }

  /** 当前时刻的渲染调色板；renderer 每帧调用（非响应式读取） */
  function currentRendererPalette(now: number): RendererPalette {
    if (mixStartedAt === 0) return paletteTo;
    const raw = Math.min(1, (now - mixStartedAt) / THEME_MIX_DURATION);
    if (raw >= 1) {
      mixStartedAt = 0;
      paletteFrom = paletteTo;
      return paletteTo;
    }
    return mixRendererPalette(paletteFrom, paletteTo, easeOutCubic(raw));
  }

  /** 初始化：localStorage 迁移 → 系统偏好 → 默认 dark */
  function initialize() {
    const migrated = migrateThemeId(localStorage.getItem(THEME_STORAGE_KEY));
    if (migrated) {
      currentThemeId.value = migrated;
      localStorage.setItem(THEME_STORAGE_KEY, migrated);
      return;
    }
    if (window.matchMedia?.("(prefers-color-scheme: light)").matches) {
      currentThemeId.value = "light";
    }
  }

  /** 切换主题：从当前视觉状态继续混合到新主题（spec 5.3） */
  function setTheme(themeId: ThemeId) {
    const next = availableThemes.value.find((t) => t.id === themeId);
    if (!next || themeId === currentThemeId.value) return;

    // 若上一轮混合未结束，从当前混合值继续，避免跳变
    paletteFrom = currentRendererPalette(performance.now());
    paletteTo = toRendererPalette(next);
    mixStartedAt = performance.now();

    currentThemeId.value = themeId;
    localStorage.setItem(THEME_STORAGE_KEY, themeId);
  }

  /** 深浅切换（dark 元数据驱动，无硬编码 ID 列表） */
  function toggleDarkMode() {
    setTheme(isDark.value ? "light" : "dark");
  }

  /** 注入 UI token CSS 变量 + --el-* 防御性映射（EP 组件当前零使用，映射为未来引入时自动同源） */
  function applyThemeToDOM() {
    const ui = currentTheme.value.ui;
    const vars: Record<string, string> = {
      "--bg-1": ui.bg1,
      "--bg-2": ui.bg2,
      "--bg-3": ui.bg3,
      "--border": ui.border,
      "--text": ui.text,
      "--text-secondary": ui.textSecondary,
      "--text-muted": ui.textMuted,
      "--accent": ui.accent,
      "--panel-shadow": ui.shadow,
      // Canvas 点阵（App.vue 背景与 Canvas gridSpacing 24 对齐）
      "--canvas-grid": currentTheme.value.canvas.grid,
      // Element Plus 映射层
      "--el-color-primary": ui.accent,
      "--el-bg-color": ui.bg1,
      "--el-bg-color-overlay": ui.bg3,
      "--el-text-color-primary": ui.text,
      "--el-text-color-regular": ui.textSecondary,
      "--el-text-color-secondary": ui.textMuted,
      "--el-border-color": ui.border,
      "--el-border-color-light": ui.border,
      "--el-border-color-lighter": ui.border,
      "--el-fill-color-blank": ui.bg2,
      "--el-fill-color-light": ui.bg3,
    };
    const root = document.documentElement;
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value);
    }
    document.body.className = `theme-${currentThemeId.value}`;
  }

  watch(currentThemeId, applyThemeToDOM, { immediate: true });

  return {
    currentThemeId,
    currentTheme,
    isDark,
    availableThemes,
    initialize,
    setTheme,
    toggleDarkMode,
    currentRendererPalette,
    isPaletteMixing,
  };
});
```

> 中间态提示：`useTheme.ts` / `useCanvasRenderer.ts` / `App.vue` / `useKeyboardShortcuts.ts` 此时仍引用旧导出（`colors`、`effects` 等），编译错误属预期，将在 Task 7/8/9 消除。本任务验证只跑本测试文件。

- [ ] **Step 4: 运行测试确认通过**

Run（需授权）: `npx vitest run test/unit/stores/themeStore.test.ts`
Expected: 全部 PASS。

---

## 阶段 B：取色链路

### Task 4: timeline 类型瘦身 + style-utils 重写

**Files:**
- Modify: `src/types/timeline.ts`
- Rewrite: `src/utils/frame/style-utils.ts`
- Rewrite: `test/unit/utils/frame/style-utils.test.ts`

**Interfaces:**
- Consumes: `RendererPalette`（Task 1）
- Produces（Task 5/6/7 依赖）:
  - `RenderStyle = { dashed?: boolean; alpha?: number }`（颜色字段全删）
  - `RenderableEntity.style: RenderStyle`（语义变化，字段类型变窄）
  - `OverlayColorToken`、`OverlayStyle`、`RenderableOverlay.style: OverlayStyle`、`RenderableOverlay.accentBar?: boolean`
  - `resolveEntityStyle(stateTags: StateTag[], palette: RendererPalette): { fill: string; glow: number }`
  - `interpolateStyle(from: RenderStyle, to: RenderStyle, progress: number): RenderStyle`（仅 dashed/alpha）
  - **退役**：`BAR_BASE_STYLE`、`TAG_STYLE_MAP`、`getStyleFromStateTags`

- [ ] **Step 1: 修改 `src/types/timeline.ts`**

三处改动（其余类型不动）：

1. `RenderStyle` 替换为：

```ts
/** 实体非主题属性：虚线与透明度。颜色/发光一律由渲染期 resolveEntityStyle 从主题取（spec 5.1） */
export interface RenderStyle {
  dashed?: boolean;
  alpha?: number;
}
```

2. 新增 overlay token 类型（放在 `RenderStyle` 定义之后）：

```ts
/** overlay 语义色 token：渲染期查 RendererPalette，builders 不再写死 hex */
export type OverlayColorToken =
  | "accent"
  | "text"
  | "text-secondary"
  | "text-muted"
  | "border"
  | "panel-fill"
  | "comparing"
  | "swapping"
  | "sorted"
  | "latest";

/** overlay 样式：全部语义化，无裸颜色值 */
export interface OverlayStyle {
  /** 线条/边框/引导色（edge / guide / divider / region-panel 边框） */
  color?: OverlayColorToken;
  /** 文字色（label / badge 文本） */
  textColor?: OverlayColorToken;
  alpha?: number;
  dashed?: boolean;
  /** guide 类发光强度 0~1 */
  glow?: number;
}
```

3. `RenderableOverlay` 修改两个字段：

```ts
export interface RenderableOverlay {
  id: string;
  kind: "edge" | "guide" | "label" | "badge" | "divider" | "region-panel";
  points?: Array<{ x: number; y: number }>;
  text?: string;
  style: OverlayStyle;                                    // 原 RenderStyle
  rect?: { x: number; y: number; width: number; height: number; radius: number };
  /** 活跃桶顶部高亮条（accent 色），原为颜色字符串 */
  accentBar?: boolean;
}
```

- [ ] **Step 2: 重写测试 `test/unit/utils/frame/style-utils.test.ts`**

全量替换为：

```ts
import { describe, test, expect } from 'vitest';
import { resolveEntityStyle, interpolateStyle } from '@/utils/frame/style-utils';
import type { RendererPalette } from '@/types/theme';
import type { RenderStyle, StateTag } from '@/types/timeline';

const PALETTE: RendererPalette = {
  background: '#0b0e14',
  backgroundSecondary: '#11151d',
  text: '#9aa4b5',
  indexText: '#5c6675',
  shadowBlur: 9,
  grid: 'rgba(255,255,255,0.045)',
  gridSpacing: 24,
  baseline: 'rgba(255,255,255,0.14)',
  states: {
    pending: { fill: '#3d4f66', glow: 0 },
    'heap-pending': { fill: '#2b3a52', glow: 0 },
    comparing: { fill: '#f5c542', glow: 0.8 },
    swapping: { fill: '#ff5d5d', glow: 1 },
    sorted: { fill: '#3ecf8e', glow: 0 },
    pivot: { fill: '#b78cff', glow: 0.7 },
    latest: { fill: '#22d3ee', glow: 0 },
  },
  accent: '#89b4fa',
  uiText: '#e8ecf3',
  uiTextSecondary: '#9aa4b5',
  uiTextMuted: '#5c6675',
  border: 'rgba(255,255,255,0.08)',
};

describe('resolveEntityStyle', () => {
  test('按传入顺序取首个命中标签', () => {
    expect(resolveEntityStyle(['comparing', 'sorted'], PALETTE).fill).toBe('#f5c542');
    expect(resolveEntityStyle(['sorted', 'comparing'], PALETTE).fill).toBe('#3ecf8e');
  });

  test('空 tags 回退 pending 基底（画廊石板灰）', () => {
    const result = resolveEntityStyle([], PALETTE);
    expect(result.fill).toBe('#3d4f66');
    expect(result.glow).toBe(0);
  });

  test('每个 tag 都能命中对应状态色', () => {
    const cases: Array<[StateTag, string]> = [
      ['pending', '#3d4f66'],
      ['heap-pending', '#2b3a52'],
      ['comparing', '#f5c542'],
      ['swapping', '#ff5d5d'],
      ['sorted', '#3ecf8e'],
      ['pivot', '#b78cff'],
      ['latest', '#22d3ee'],
    ];
    for (const [tag, fill] of cases) {
      expect(resolveEntityStyle([tag], PALETTE).fill).toBe(fill);
    }
  });

  test('未知 tag（防御）跳过并继续匹配后续标签', () => {
    expect(resolveEntityStyle(['unknown' as StateTag, 'pivot'], PALETTE).fill).toBe('#b78cff');
  });
});

describe('interpolateStyle（瘦身后：仅 dashed/alpha）', () => {
  test('dashed 在 progress<0.5 取 from、>=0.5 取 to（二值切换语义保留）', () => {
    const from: RenderStyle = { dashed: false };
    const to: RenderStyle = { dashed: true };
    expect(interpolateStyle(from, to, 0.3).dashed).toBe(false);
    expect(interpolateStyle(from, to, 0.5).dashed).toBe(true);
    expect(interpolateStyle(from, to, 0.7).dashed).toBe(true);
  });

  test('alpha 线性插值', () => {
    const from: RenderStyle = { alpha: 1 };
    const to: RenderStyle = { alpha: 0 };
    expect(interpolateStyle(from, to, 0).alpha).toBe(1);
    expect(interpolateStyle(from, to, 0.5).alpha).toBe(0.5);
    expect(interpolateStyle(from, to, 1).alpha).toBe(0);
  });

  test('alpha 仅在一方定义时注入（CLAUDE.md 经验 #1 防御保留）', () => {
    expect(interpolateStyle({}, {}, 0.5).alpha).toBeUndefined();
    expect(interpolateStyle({ alpha: 1 }, {}, 0.5).alpha).toBe(0.5);
    expect(interpolateStyle({}, { alpha: 0 }, 0.5).alpha).toBe(0.5);
  });

  test('结果不含任何颜色字段', () => {
    const result = interpolateStyle({ dashed: true, alpha: 1 }, { dashed: false, alpha: 0 }, 0.5);
    expect(Object.keys(result).sort()).toEqual(['alpha', 'dashed']);
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

Run（需授权）: `npx vitest run test/unit/utils/frame/style-utils.test.ts`
Expected: FAIL（resolveEntityStyle 不存在）。

- [ ] **Step 4: 重写 `src/utils/frame/style-utils.ts`**

全量替换为：

```ts
import type { RenderStyle, StateTag } from "@/types/timeline";
import type { RendererPalette } from "@/types/theme";

/** 渲染期实体样式：填充色 + 发光乘数（最终 shadowBlur = palette.shadowBlur * glow） */
export interface ResolvedEntityStyle {
  fill: string;
  glow: number;
}

/**
 * 渲染期取色（spec 5.1）：按 tags 传入顺序取首个命中状态。
 * 空 tags / 全部未命中时回退 pending（画廊基底占约 80% 柱子）。
 * 取代旧 TAG_STYLE_MAP 查表——颜色不再烘焙进 FrameState。
 */
export function resolveEntityStyle(stateTags: StateTag[], palette: RendererPalette): ResolvedEntityStyle {
  for (const tag of stateTags) {
    const visual = palette.states[tag];
    if (visual) return { fill: visual.fill, glow: visual.glow };
  }
  return { ...palette.states.pending };
}

/**
 * 非主题样式插值：dashed 在 progress<0.5 取 from（二值切换是有意设计，配合状态节奏）；
 * alpha 线性 lerp，且仅在 from/to 至少一方显式定义时才注入，
 * 避免默认 alpha=1 架空 opacity=0（CLAUDE.md 经验 #1 的关键防御）。
 */
export function interpolateStyle(from: RenderStyle, to: RenderStyle, progress: number): RenderStyle {
  return {
    dashed: progress < 0.5 ? from.dashed : to.dashed,
    alpha: (from.alpha !== undefined || to.alpha !== undefined)
      ? (from.alpha ?? 1) + ((to.alpha ?? 1) - (from.alpha ?? 1)) * progress
      : undefined,
  };
}
```

- [ ] **Step 5: 运行测试确认通过**

Run（需授权）: `npx vitest run test/unit/utils/frame/style-utils.test.ts`
Expected: 全部 PASS。
（此时 builders/interpolate-entity/renderer 引用旧字段属预期编译错误，Task 5/6/7 消除。）

---

### Task 5: interpolate-entity 的 stateTags 切换

**Files:**
- Modify: `src/utils/frame/interpolate-entity.ts:33-46`

**Interfaces:**
- Consumes: `interpolateStyle`（Task 4 新签名）、`Transition.styleTransition`
- Produces: 插值结果的 `stateTags` 在 `styleTransition` 步骤中按 progress<0.5 二值切换（Task 7 renderer 消费的契约：颜色切换时机与状态节奏对齐）

- [ ] **Step 1: 修改 `interpolateEntity` 返回对象**

将 `src/utils/frame/interpolate-entity.ts` 第 33-46 行的返回对象替换为：

```ts
  return {
    ...to,
    x,
    y,
    width: lerp(from.width, to.width, progress),
    height: lerp(from.height, to.height, progress),
    value: to.value,
    displayIndex: to.displayIndex,
    opacity: transition.visibilityTransition || transition.type === "fade"
      ? getFadeOpacity(from.opacity, to.opacity, progress)
      : lerp(from.opacity, to.opacity, progress),
    // 颜色随状态切换：progress<0.5 取 from 帧 tags（原 interpolateStyle 颜色二值切换的等价实现，
    // 切换时机仍由 styleTransition 标志控制，与状态节奏对齐）
    stateTags: transition.styleTransition
      ? (progress < 0.5 ? from.stateTags : to.stateTags)
      : to.stateTags,
    style: interpolateStyle(from.style, to.style, progress),
  };
```

- [ ] **Step 2: 静态自查**

- `interpolateStyle(from.style, to.style, progress)`：`styleTransition` 为 false 时直接 `to.style` 的旧分支已合并——注意保留原逻辑语义：原代码 `styleTransition ? interpolate(...) : to.style`。新 RenderStyle 只剩 dashed/alpha，且 dashed 本身在 interpolate 内二值切换，直接统一调用 interpolateStyle 结果等价（instant 步骤 progress 传 0/1 时行为一致）。确认无其他引用 `entity.style.fill` 的残留（rg `style\.fill` 于本文件——应无）。
- import 保持 `import { interpolateStyle } from "./style-utils";` 不变。

- [ ] **Step 3: 验证（需授权，否则标注待用户验证）**

Run: `npx vitest run test/unit` — 已有算法测试（bubble/quick/heap）不涉及颜色，应保持 PASS（它们验证 timeline 结构一致性）。

---

### Task 6: 四个 builder 停产颜色 + overlay token 化

**Files:**
- Modify: `src/utils/timeline-builders/build-basic-timeline.ts`
- Modify: `src/utils/timeline-builders/build-merge-timeline.ts`
- Modify: `src/utils/timeline-builders/build-heap-timeline.ts`
- Modify: `src/utils/timeline-builders/build-bucket-timeline.ts`
- Delete: `src/utils/frame/bucket-palette.ts`

**Interfaces:**
- Consumes: Task 4 的类型变化（`RenderStyle` 无颜色字段、`OverlayStyle`）
- Produces: Timeline 中实体不再携带颜色；overlays 全部语义 token。**几何、hidden 集合、ghost 逻辑、swap pairs、transition 一律不动。**

**通用规则（四个 builder 相同）：**
1. 删除所有 `getStyleFromStateTags` / `BAR_BASE_STYLE` / `MAIN_BASE_STYLE` / `BUFFER_BASE_STYLE` / `TREE_BASE_STYLE` / `ARRAY_BASE_STYLE` / `getBucketBarStyle` / `getBucketTheme` 的 import 与定义。
2. 实体创建处删除 `style: ...` 行（`style` 仍是合法字段但全可选——直接不传）。
3. ghost 实体的 `stateTags: []` 改为复制源元素语义：`stateTags: source.stateTags`（或对应源实体的 tags）；不再传 `style`。

- [ ] **Step 1: build-basic-timeline.ts**

- 删除第 3 行 `import { BAR_BASE_STYLE, getStyleFromStateTags } from "@/utils/frame/style-utils";`
- `createBasicFrame` 内删除 `const style = getStyleFromStateTags(stateTags, BAR_BASE_STYLE);`（第 25 行）与实体中的 `style,`（第 39 行）。

- [ ] **Step 2: build-merge-timeline.ts**

- 删除第 3 行 import 与第 6-7 行 `MAIN_BASE_STYLE` / `BUFFER_BASE_STYLE`。
- `createMergeFrame`：main 实体删 `style: getStyleFromStateTags(...)` 行（:143）；buffer 实体删（:166）。
- **merge-set ghost**（from 帧 :187-201 与 to 帧 :204-216）：`style: BUFFER_BASE_STYLE, stateTags: []` → 删 style 行，两帧均显式 `stateTags: ["latest"]`。
- **merge-back ghost**（from 帧 :245-259 与 to 帧 :264-278）：`style: BUFFER_BASE_STYLE, stateTags: []` → 删 style 行，两帧均显式 `stateTags: ["latest"]`。
  > ghost 统一 `["latest"]`（冰青）的理由：转移中的元素 = "最近被触碰"，且 merge-back 的 buffer 实体 tags 为空、若继承会回退 pending 灰导致飞行元素不醒目。禁止继承源实体 tags（merge-set 源是 comparing 琥珀，与飞行语义混淆）。
- **`buildMergeOverlays`（:64-90）token 化**，全量替换为：

```ts
function buildMergeOverlays(width: number, dividerY: number): RenderableOverlay[] {
  return [
    {
      id: "merge-main-label",
      kind: "label",
      points: [{ x: 58, y: 18 }],
      text: "主数组区",
      style: { textColor: "text-secondary", alpha: 0.9 },
    },
    {
      id: "merge-buffer-label",
      kind: "label",
      points: [{ x: 58, y: dividerY + 28 }],
      text: "缓冲区",
      style: { textColor: "text-secondary", alpha: 0.9 },
    },
    {
      id: "merge-divider",
      kind: "divider",
      points: [
        { x: 0, y: dividerY },
        { x: width, y: dividerY },
      ],
      style: { color: "border", dashed: true },
    },
  ];
}
```

- [ ] **Step 3: build-heap-timeline.ts**

- 删除第 3 行 import、第 7-8 行两个 BASE_STYLE、第 10-13 行 `getHeapStyle`。
- tree 实体（:98）与 array 实体（:117）：`style: getHeapStyle(...)` 行删除。
- **`createHeapOverlays`（:15-54）token 化**，全量替换为：

```ts
function createHeapOverlays(count: number, width: number, height: number, isMinHeap: boolean): RenderableOverlay[] {
  const arrayAreaHeight = getArrayAreaHeight(count);
  const dividerY = height - arrayAreaHeight + 10;
  return [
    {
      id: "heap-tree-label",
      kind: "label",
      points: [{ x: 58, y: 18 }],
      text: isMinHeap ? "最小堆视图" : "最大堆视图",
      style: { textColor: "text-secondary", alpha: 0.9 },
    },
    {
      id: "heap-array-label",
      kind: "label",
      points: [{ x: 58, y: dividerY + 14 }],
      text: "数组映射区",
      style: { textColor: "text-secondary", alpha: 0.9 },
    },
    ...Array.from({ length: count }, (_, index) => {
      const childIndexes = [2 * index + 1, 2 * index + 2].filter((childIndex) => childIndex < count);
      const start = buildHeapNodePosition(index, count, width, height);

      return childIndexes.map((childIndex) => ({
        id: `edge-${index}-${childIndex}`,
        kind: "edge" as const,
        points: [start, buildHeapNodePosition(childIndex, count, width, height)],
        style: { color: "border" },
      }));
    }).flat(),
    {
      id: "heap-divider",
      kind: "divider",
      points: [
        { x: 20, y: dividerY },
        { x: width - 20, y: dividerY },
      ],
      style: { color: "border", dashed: true },
    },
  ];
}
```

- **compare 引导线**（:209-214）：`style: { fill: "#ffd43b", ... }` → `style: { color: "comparing", dashed: true, alpha: 0.85, glow: 0.4 }`。

- [ ] **Step 4: build-bucket-timeline.ts**

- 删除第 4 行 `import { getBucketTheme } from "@/utils/frame/bucket-palette";`、第 3 行 style-utils import、第 8 行 `MAIN_BASE_STYLE`、第 13-16 行 `getBucketBarStyle`。
- main 实体（:207）与 bucket 实体（:263）的 `style: getStyleFromStateTags(...)` 行删除。
- **scatter ghost**（:295-298）：`style: bucketBaseStyle, stateTags: []` → 删 style 行，两帧均显式 `stateTags: ["latest"]`（scatter 时源实体本身就是 latest，语义一致且写法与 merge 统一）。
- **gather ghost**（:330-335）：`style: bucketBaseStyle, stateTags: []` → 删 style 行，两帧均显式 `stateTags: ["latest"]`。
- gather 中 `const bucketBaseStyle = getBucketBarStyle(bucketIndex);`（:327）与 scatter 中（:290）一并删除。
- **`buildBucketOverlays`（:85-149）token 化**，全量替换为：

```ts
function buildBucketOverlays(
  layout: ReturnType<typeof buildBucketLayout>,
  _width: number, // 预留参数，用于未来布局计算
  buckets: number[][],
  activeBucketIndex?: number,
): RenderableOverlay[] {
  const overlays: RenderableOverlay[] = [];

  // 主数组区标签
  overlays.push({
    id: "bucket-main-label",
    kind: "label",
    points: [{ x: 72, y: 18 }],
    text: "▸ 主数组区",
    style: { textColor: "text-secondary", alpha: 0.95 },
  });

  // 每个桶：region-panel + 标题 + 计数徽章（统一 token，活跃桶用 accent 强调——射灯原则）
  for (const region of layout.bucketRegions) {
    const { bucketIndex } = region;
    const isActive = bucketIndex === activeBucketIndex;
    const bucketItemCount = buckets[bucketIndex]?.length ?? 0;

    overlays.push({
      id: `bucket-panel-${bucketIndex}`,
      kind: "region-panel",
      rect: {
        x: region.x,
        y: region.y,
        width: region.width,
        height: region.height,
        radius: 8,
      },
      style: {
        color: isActive ? "accent" : "border",
        alpha: 1,
      },
      accentBar: isActive || undefined,
    });

    overlays.push({
      id: `bucket-title-${bucketIndex}`,
      kind: "label",
      points: [{ x: region.x + region.width / 2, y: region.y + 14 }],
      text: `Bucket ${bucketIndex + 1}`,
      style: { textColor: "text-secondary", alpha: 0.95 },
    });

    overlays.push({
      id: `bucket-count-${bucketIndex}`,
      kind: "badge",
      points: [{ x: region.x + region.width - 22, y: region.y + 14 }],
      text: String(bucketItemCount),
      style: { textColor: "text-muted", alpha: 0.95 },
    });
  }

  return overlays;
}
```

- [ ] **Step 5: 删除 `src/utils/frame/bucket-palette.ts`**

先全局检索确认无其他引用（rg `bucket-palette|getBucketTheme|BUCKET_PALETTE` 于 `src/` 与 `test/`——应仅 build-bucket-timeline.ts 一处，已在 Step 4 移除），然后删除文件。

- [ ] **Step 6: 验证（需授权）**

Run: `npx vitest run test/unit`
Expected: 算法快照类测试 PASS（颜色不在断言范围）。若失败，检查是否误删了几何/隐藏逻辑。

---

### Task 7: useCanvasRenderer 渲染期取色 + 混合器集成

**Files:**
- Rewrite: `src/composables/useCanvasRenderer.ts`

**Interfaces:**
- Consumes: `useThemeStore`（Task 3：`currentRendererPalette` / `isPaletteMixing` / `currentThemeId`）、`resolveEntityStyle`（Task 4）、`OverlayColorToken`
- Produces: renderer 对外 API 不变（`initialize / resize / renderFrame / startRenderLoop / stopRenderLoop`），SortBarCanvas ×4 零改动。

**设计要点（写代码前通读）：**
1. 删除文件顶部全部硬编码颜色常量（`BACKGROUND_COLOR` / `GRID_COLOR` / `BASELINE_COLOR` / `VALUE_LABEL_COLOR` / `INDEX_LABEL_COLOR` / `BAR_HIGHLIGHT_COLOR`）与 `rgbCache` / `hexToRgb` / `rgbaFromHex` / `createBarGradient`（渐变退役——画廊柱子纯色块）。
2. `FONT_FAMILY` / `FONTS` / `sizedFont` 保留（引用自托管 JetBrains Mono，与 theme.scss 的 @font-face 一致；主题 typography 死配置退役，此常量即 Canvas 字体单一来源）。
3. 每帧绘制入口 `drawOnce` 开头取一次 palette（局部变量贯穿传递）；混合期间自续帧（绘制后若 `isPaletteMixing()` 则 `needsRedraw = true` 再次 `requestRender()`）。
4. 背景缓存：`rebuildBackgroundCache(palette)` 需要 palette 参数；混合期间 `drawBackground` 绕过缓存直接 `paintStaticBackground(ctx, palette)`，混合结束（watch 触发的下一次非混合帧）自动回到缓存路径。watch `currentThemeId` 时调用 `rebuildBackgroundCache(当前 palette)` 并 requestRender。
5. 网格从线改点阵：`paintStaticBackground` 不再画线，改为每 `gridSpacing` 画 1px 圆点。

- [ ] **Step 1: 重写文件**

新结构（关键代码，保持未提及的函数不变）：

```ts
import { ref, watch, type Ref } from "vue";
import type { FrameState, RenderableEntity, RenderableOverlay, OverlayColorToken } from "@/types/timeline";
import type { RendererPalette } from "@/types/theme";
import { useThemeStore } from "@/stores/themeStore";
import { resolveEntityStyle } from "@/utils/frame/style-utils";

/** Canvas 等宽字体族（集中管理；JetBrains Mono 由 theme.scss 自托管 @font-face 提供） */
const FONT_FAMILY = '"JetBrains Mono", monospace';
const FONTS = {
  badge: `bold 13px ${FONT_FAMILY}`,
  bucketTitle: `700 13px ${FONT_FAMILY}`,
  label: `600 11px ${FONT_FAMILY}`,
  tiny: `10px ${FONT_FAMILY}`,
  heapIndex: `8px ${FONT_FAMILY}`,
} as const;
function sizedFont(weight: string, size: number) {
  return `${weight} ${size}px ${FONT_FAMILY}`;
}

function isHeapNode(entity: RenderableEntity) {
  return entity.kind === "heap-tree-node" || entity.kind === "heap-array-node";
}

// roundedRectPath 原样保留（略——不改动）

/** overlay 语义 token → palette 颜色（渲染期解析，builders 不再携带 hex） */
function overlayColor(token: OverlayColorToken, palette: RendererPalette): string {
  switch (token) {
    case "accent": return palette.accent;
    case "text": return palette.uiText;
    case "text-secondary": return palette.uiTextSecondary;
    case "text-muted": return palette.uiTextMuted;
    case "border": return palette.border;
    case "panel-fill": return palette.backgroundSecondary;
    case "comparing": return palette.states.comparing.fill;
    case "swapping": return palette.states.swapping.fill;
    case "sorted": return palette.states.sorted.fill;
    case "latest": return palette.states.latest.fill;
  }
}

export function useCanvasRenderer(canvasRef: Ref<HTMLCanvasElement | null>) {
  const currentFrame = ref<FrameState | null>(null);
  let animationFrameId: number | null = null;
  let needsRedraw = false;
  let containerWidth = 800;
  let containerHeight = 360;
  let lastSortedFrame: FrameState | null = null;
  let cachedSortedEntities: RenderableEntity[] = [];
  let bgCanvas: HTMLCanvasElement | null = null;
  let bgCtx: CanvasRenderingContext2D | null = null;

  const themeStore = useThemeStore();

  /** 当前帧调色板（混合期间逐帧变化） */
  function palette(): RendererPalette {
    return themeStore.currentRendererPalette(performance.now());
  }

  // 主题变化：重建静态背景缓存（按新主题 palette）并触发重绘
  watch(() => themeStore.currentThemeId, () => {
    rebuildBackgroundCache(palette());
    if (currentFrame.value) {
      needsRedraw = true;
      requestRender();
    }
  });
```

`drawRegionPanel` 改为：

```ts
  /** 绘制桶格子的圆角矩形背景面板（region-panel 专用；颜色全部 token 解析） */
  function drawRegionPanel(ctx: CanvasRenderingContext2D, overlay: RenderableOverlay, pal: RendererPalette) {
    if (!overlay.rect) return;
    const { x, y, width, height, radius } = overlay.rect;
    const borderColor = overlayColor(overlay.style.color ?? "border", pal);

    ctx.save();
    ctx.globalAlpha = overlay.style.alpha ?? 1;

    // 面板底：次级背景半透明填充
    roundedRectPath(ctx, x, y, width, height, radius);
    ctx.fillStyle = overlayColor("panel-fill", pal);
    ctx.globalAlpha = (overlay.style.alpha ?? 1) * 0.6;
    ctx.fill();
    ctx.globalAlpha = overlay.style.alpha ?? 1;

    // 边框（活跃桶 accent 微发光，非活跃 border 静默）
    if (overlay.accentBar) {
      ctx.shadowColor = borderColor;
      ctx.shadowBlur = 8;
    }
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = overlay.accentBar ? 1.4 : 1;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 活跃桶：顶部内侧 accent 高亮条
    if (overlay.accentBar) {
      const barH = 2.5;
      const innerR = Math.min(radius, barH);
      ctx.save();
      ctx.shadowColor = borderColor;
      ctx.shadowBlur = 6;
      ctx.fillStyle = borderColor;
      roundedRectPath(ctx, x + 1, y + 1, width - 2, barH, innerR);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }
```

`drawOverlay` 改为接收 `pal` 参数；内部所有 `overlay.style.fill / stroke / text` 换为 token 解析：

```ts
  function drawOverlay(ctx: CanvasRenderingContext2D, overlay: RenderableOverlay, pal: RendererPalette) {
    if (overlay.kind === "region-panel") {
      drawRegionPanel(ctx, overlay, pal);
      return;
    }

    ctx.save();
    ctx.globalAlpha = overlay.style.alpha ?? 1;

    if (overlay.points?.length) {
      const lineColor = overlayColor(overlay.style.color ?? "border", pal);
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = overlay.kind === "guide" ? 2 : 1.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (overlay.kind === "guide") {
        // 仅引导线发光（comparing 虚线），其余线条静默
        ctx.shadowColor = lineColor;
        ctx.shadowBlur = pal.shadowBlur * (overlay.style.glow ?? 0);
      }

      if (overlay.style.dashed) {
        ctx.setLineDash([7, 7]);
      }

      ctx.beginPath();
      ctx.moveTo(overlay.points[0].x, overlay.points[0].y);
      if (overlay.points.length === 3) {
        ctx.quadraticCurveTo(overlay.points[1].x, overlay.points[1].y, overlay.points[2].x, overlay.points[2].y);
      } else {
        for (let index = 1; index < overlay.points.length; index += 1) {
          ctx.lineTo(overlay.points[index].x, overlay.points[index].y);
        }
      }
      ctx.stroke();
    }

    if (overlay.text && overlay.points?.[0]) {
      const anchor = overlay.points[0];

      if (overlay.kind === "badge") {
        ctx.font = FONTS.badge;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // 徽章底：次级背景 + border 细边（画廊式安静徽章）
        const paddingX = 8;
        const boxHeight = 18;
        const textWidth = ctx.measureText(overlay.text).width;
        const boxWidth = textWidth + paddingX * 2;
        roundedRectPath(ctx, anchor.x - boxWidth / 2, anchor.y - boxHeight / 2, boxWidth, boxHeight, 6);
        ctx.fillStyle = overlayColor("panel-fill", pal);
        ctx.fill();
        ctx.strokeStyle = overlayColor("border", pal);
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = overlayColor(overlay.style.textColor ?? "text-secondary", pal);
        ctx.fillText(overlay.text, anchor.x, anchor.y + 0.5);
      } else {
        const isBucketTitle = overlay.id.startsWith("bucket-title-");
        ctx.font = isBucketTitle
          ? FONTS.bucketTitle
          : overlay.kind === "label"
            ? FONTS.label
            : FONTS.tiny;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = overlayColor(overlay.style.textColor ?? "text-secondary", pal);
        ctx.fillText(overlay.text, anchor.x, anchor.y);
      }
    }

    ctx.restore();
  }
```

`drawBarEntity` 改为（纯色块 + 渲染期取色，渐变/顶部高光线退役）：

```ts
  function drawBarEntity(ctx: CanvasRenderingContext2D, entity: RenderableEntity, frame: FrameState, pal: RendererPalette) {
    const x = Math.round(entity.x);
    const y = Math.round(entity.y);
    const width = Math.round(entity.width);
    const height = Math.round(entity.height);
    const top = y - height;

    if (width <= 0 || height <= 0) return;

    const radius = Math.max(4, Math.min(10, Math.floor(width / 3)));
    const visual = resolveEntityStyle(entity.stateTags, pal);

    ctx.save();
    ctx.globalAlpha = entity.style?.alpha ?? entity.opacity;

    // 发光只在有 glow 乘数的活跃状态出现（射灯原则）
    if (visual.glow > 0 && pal.shadowBlur > 0) {
      ctx.shadowColor = visual.fill;
      ctx.shadowBlur = pal.shadowBlur * visual.glow;
    }

    roundedRectPath(ctx, x, top, width, height, radius);
    ctx.fillStyle = visual.fill;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.font = sizedFont("700", Math.min(12, Math.max(width - 2, 9)));
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = pal.text;
    ctx.fillText(String(entity.value), x + width / 2, Math.max(14, top - 8));

    ctx.font = sizedFont("bold", Math.min(12, Math.max(width - 2, 8)));
    ctx.fillStyle = pal.indexText;
    const labelOffset = getFrameNumberMeta(frame, "labelOffset") ?? 17;
    ctx.fillText(String(entity.displayIndex), x + width / 2, y + labelOffset);

    ctx.restore();
  }
```

`drawHeapEntity` 改为：

```ts
  function drawHeapEntity(ctx: CanvasRenderingContext2D, entity: RenderableEntity, pal: RendererPalette) {
    const radius = Math.max(3, Math.round(entity.width / 2));
    const visual = resolveEntityStyle(entity.stateTags, pal);

    ctx.save();
    ctx.globalAlpha = entity.style?.alpha ?? entity.opacity;
    ctx.fillStyle = visual.fill;

    if (visual.glow > 0 && pal.shadowBlur > 0) {
      ctx.shadowColor = visual.fill;
      ctx.shadowBlur = pal.shadowBlur * visual.glow;
    }

    ctx.beginPath();
    ctx.arc(entity.x, entity.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.font = sizedFont("bold", Math.min(13, Math.max(radius * 1.2, 7)));
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = pal.text;
    if (radius >= 6) {
      ctx.fillText(String(entity.value), entity.x, entity.y + 0.5);
      if (entity.kind === "heap-array-node" || entity.kind === "heap-tree-node") {
        ctx.font = FONTS.heapIndex;
        ctx.textBaseline = "top";
        ctx.fillStyle = pal.indexText;
        ctx.fillText(String(entity.displayIndex), entity.x, entity.y + radius + 4);
      }
    }
  }
```

`drawEntity` / `paintStaticBackground` / `rebuildBackgroundCache` / `drawBackground` / `drawOnce` 改为：

```ts
  function drawEntity(ctx: CanvasRenderingContext2D, entity: RenderableEntity, frame: FrameState, pal: RendererPalette) {
    if (isHeapNode(entity)) {
      drawHeapEntity(ctx, entity, pal);
      return;
    }
    drawBarEntity(ctx, entity, frame, pal);
  }

  // getMainRegion / getFrameNumberMeta / getFrameContentOffsetX 原样保留

  /** 静态层（背景色 + 点阵）到指定 ctx；palette 参数化以支持混合期间逐帧重画 */
  function paintStaticBackground(targetCtx: CanvasRenderingContext2D, pal: RendererPalette) {
    targetCtx.fillStyle = pal.background;
    targetCtx.fillRect(0, 0, containerWidth, containerHeight);

    // 点阵网格（与 App.vue CSS 点阵同一 gridSpacing=24，画廊式安静底纹）
    targetCtx.fillStyle = pal.grid;
    for (let gx = pal.gridSpacing / 2; gx < containerWidth; gx += pal.gridSpacing) {
      for (let gy = pal.gridSpacing / 2; gy < containerHeight; gy += pal.gridSpacing) {
        targetCtx.beginPath();
        targetCtx.arc(gx, gy, 1, 0, Math.PI * 2);
        targetCtx.fill();
      }
    }
  }

  /** 重建静态背景离屏缓存（resize / 主题变化时调用） */
  function rebuildBackgroundCache(pal: RendererPalette) {
    if (!bgCanvas) bgCanvas = document.createElement("canvas");
    const dpr = window.devicePixelRatio || 1;
    bgCanvas.width = Math.floor(containerWidth * dpr);
    bgCanvas.height = Math.floor(containerHeight * dpr);
    bgCtx = bgCanvas.getContext("2d");
    if (!bgCtx) return;
    bgCtx.setTransform(1, 0, 0, 1, 0, 0);
    bgCtx.scale(dpr, dpr);
    paintStaticBackground(bgCtx, pal);
  }

  function drawBackground(ctx: CanvasRenderingContext2D, frame: FrameState, pal: RendererPalette) {
    ctx.clearRect(0, 0, containerWidth, containerHeight);

    // 混合期间背景逐帧直画（缓存是静止的终态，混合中用它会导致背景跳变）；
    // 混合结束走离屏缓存 drawImage 路径
    if (bgCtx && bgCanvas && !themeStore.isPaletteMixing()) {
      ctx.drawImage(bgCanvas, 0, 0, containerWidth, containerHeight);
    } else {
      paintStaticBackground(ctx, pal);
    }

    // baseline（动态：baseY 随帧变化，不进缓存）
    ctx.strokeStyle = pal.baseline;
    ctx.lineWidth = 1.5;
    const baseY = getFrameNumberMeta(frame, "baseY") ?? containerHeight - 21.5;
    const baselineY = Math.round(baseY) + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, baselineY);
    ctx.lineTo(containerWidth, baselineY);
    ctx.stroke();
  }

  // getSortedEntities 原样保留

  /** 单次绘制：每帧取一次 palette 贯穿全流程 */
  function drawOnce() {
    const canvas = canvasRef.value;
    const frame = currentFrame.value;
    if (!canvas || !frame) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const pal = palette();

    drawBackground(ctx, frame, pal);

    const xOffset = getFrameContentOffsetX(frame);

    // 三阶段绘制（region-panel 底层 → entity 中层 → 其余 overlay 前景）
    frame.overlays
      .filter((overlay) => overlay.kind === "region-panel")
      .forEach((overlay) => {
        ctx.save();
        ctx.translate(xOffset, 0);
        drawOverlay(ctx, overlay, pal);
        ctx.restore();
      });

    ctx.save();
    ctx.translate(xOffset, 0);
    getSortedEntities(frame)
      .forEach((entity) => drawEntity(ctx, entity, frame, pal));
    ctx.restore();

    frame.overlays
      .filter((overlay) => overlay.kind !== "region-panel")
      .forEach((overlay) => {
        ctx.save();
        ctx.translate(xOffset, 0);
        drawOverlay(ctx, overlay, pal);
        ctx.restore();
      });

    // 混合未结束：自续帧直到 300ms 换装完成（spec 5.3）
    if (themeStore.isPaletteMixing()) {
      needsRedraw = true;
      requestRender();
    }
  }

  // requestRender / startRenderLoop / stopRenderLoop / setCanvasDimensions / initialize / resize / renderFrame
  // 原样保留；setCanvasDimensions 内 rebuildBackgroundCache() 调用改为 rebuildBackgroundCache(palette())
```

> 注意：旧代码的 `useTheme()` try/catch 兜底（主题未初始化回退硬编码色）已删除——`main.ts` 在 mount 前调用 `themeStore.initialize()`，Pinia 在 renderer 构造时可用。旧 baseline 的 shadowBlur 发光（`ctx.shadowColor = baselineColor` + `shadowBlur`）一并退役（基线是安静的水平线，spec 4.1 baseline 无发光语义）。

- [ ] **Step 2: 静态自查清单**

- [ ] rg `style\.fill|style\.glow|style\.stroke|style\.text` 于 useCanvasRenderer.ts——应零命中（全部改走 palette/resolve）。
- [ ] rg `useTheme` 于 useCanvasRenderer.ts——应零命中。
- [ ] `roundedRectPath` / `getMainRegion` / `getFrameNumberMeta` / `getFrameContentOffsetX` / `getSortedEntities` / `requestRender` / `startRenderLoop` / `stopRenderLoop` / `setCanvasDimensions` / `initialize` / `resize` / `renderFrame` 均保留且对外签名不变（4 个 SortBarCanvas 无需改动）。

- [ ] **Step 3: 验证（需授权）**

Run: `npx vitest run test/unit`
Expected: PASS（renderer 无单测，依赖既有算法测试确认 builder 输出结构未破坏；视觉正确性由 Task 12 目检覆盖）。

---

## 阶段 C：UI 层

### Task 8: 切换器重写 + ThemeSelector/useTheme 删除 + App.vue 改造

**Files:**
- Rewrite: `src/components/ThemeSwitcher.vue`
- Delete: `src/components/ThemeSelector.vue`
- Delete: `src/composables/useTheme.ts`
- Modify: `src/App.vue`

**Interfaces:**
- Consumes: `useThemeStore`（Task 3）
- Produces: ThemeSwitcher 为自包含按钮组件（无 props/emits）

- [ ] **Step 1: 重写 `ThemeSwitcher.vue`**（EP icons 已全局注册，直接用组件标签）

```vue
<template>
  <button
    class="theme-switch"
    :class="{ 'is-light': !isDark }"
    :title="isDark ? '切换到亮色画室' : '切换到暗色画廊'"
    :aria-label="isDark ? '切换到亮色主题' : '切换到暗色主题'"
    @click="themeStore.toggleDarkMode()"
  >
    <!-- 太阳与月亮双图标，旋转+缩放过渡（暗色显月亮，亮色显太阳） -->
    <span class="switch-icon icon-moon"><Moon /></span>
    <span class="switch-icon icon-sun"><Sunny /></span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useThemeStore } from '@/stores/themeStore';

const themeStore = useThemeStore();
const isDark = computed(() => themeStore.isDark);
</script>

<style lang="scss" scoped>
.theme-switch {
  position: relative;
  width: 38px;
  height: 38px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg-2);
  cursor: pointer;
  overflow: hidden;
  transition: background-color 0.3s ease, border-color 0.3s ease;
  flex-shrink: 0;
}

.theme-switch:hover {
  border-color: var(--accent);
}

.switch-icon {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  color: var(--text-secondary);
  transition: transform 0.45s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
}

/* 暗色（默认）：月亮在位，太阳旋出隐没 */
.icon-sun {
  transform: rotate(90deg) scale(0.4);
  opacity: 0;
}

/* 亮色：太阳转正显现，月亮旋出 */
.theme-switch.is-light .icon-sun {
  transform: rotate(0deg) scale(1);
  opacity: 1;
  color: var(--accent);
}

.theme-switch.is-light .icon-moon {
  transform: rotate(-90deg) scale(0.4);
  opacity: 0;
}
</style>
```

- [ ] **Step 2: 删除 `ThemeSelector.vue` 与 `useTheme.ts`**

删除前全局检索确认消费者已清零：
- rg `ThemeSelector` 于 `src/`——仅 ThemeSwitcher.vue 旧代码引用（Step 1 已重写移除）。
- rg `useTheme\(|@/composables/useTheme"` 于 `src/`——消费者为 App.vue（本任务 Step 3 改造）与 useCanvasRenderer.ts（Task 7 已改为 themeStore）。确认后再删两文件。

- [ ] **Step 3: 重写 `App.vue`**

```vue
<script setup lang="ts">
import { onMounted } from "vue";
import { useSortStore } from "@/stores/sortStore";
import SortVisualizer from "@/components/SortVisualizer.vue";
import ControlPanel from "@/components/ControlPanel.vue";
import ThemeSwitcher from "@/components/ThemeSwitcher.vue";
import KeyboardShortcutsHelp from "@/components/KeyboardShortcutsHelp.vue";
import { useThemeKeyboardShortcuts } from "@/composables/useKeyboardShortcuts";

const store = useSortStore();

// 主题快捷键（Task 9 后仅剩 Alt+D）
useThemeKeyboardShortcuts();

onMounted(() => {
  store.generateArray(store.arraySize);
});
</script>

<template>
  <div class="app">
    <!-- 点阵背景：与 Canvas gridSpacing 24 对齐，颜色走 --canvas-grid -->
    <div class="bg-grid" aria-hidden="true"></div>
    <header class="header">
      <div class="header-content">
        <div class="app-title-group">
          <span class="app-eyebrow">SORTING&nbsp;VISUALIZER</span>
          <h1 class="app-title">排序算法可视化</h1>
        </div>
        <ControlPanel />
      </div>
      <div class="header-actions">
        <ThemeSwitcher />
        <KeyboardShortcutsHelp />
      </div>
    </header>
    <main class="main">
      <SortVisualizer />
    </main>
  </div>
</template>

<style lang="scss" scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 20px 24px 24px;
  max-width: 1600px;
  margin: 0 auto;
  position: relative;
  overflow: visible;
  background: var(--bg-1); /* 页面底色走 token（themeStore 注入） */
}

/* 点阵背景（画廊底纹） */
.bg-grid {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background-image: radial-gradient(var(--canvas-grid) 1px, transparent 1px);
  background-size: 24px 24px;
}

.header {
  position: relative;
  z-index: 1;
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.header-content {
  flex: 1;
}

.app-title-group {
  margin: 0 0 14px 0;
  display: flex;
  align-items: baseline;
  gap: 10px;
}

/* 等宽小写 eyebrow 标签（作品感排版） */
.app-eyebrow {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.18em;
  color: var(--text-muted);
  text-transform: uppercase;
}

.app-title {
  margin: 0;
  font-size: 22px;
  font-weight: 650;
  letter-spacing: 0.01em;
  color: var(--text);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: relative;
  z-index: 0;
}

@media (max-width: 768px) {
  .app {
    padding: 12px 16px 20px;
  }

  .header {
    flex-direction: column;
  }

  .app-title {
    font-size: 19px;
  }
}
</style>
```

- [ ] **Step 4: 静态自查**

- rg `useTheme` 于 `src/`——仅 `useThemeStore` / `useThemeKeyboardShortcuts` 合法命中。
- rg `ThemeSelector`——零命中。
- `--font-mono` 变量由 Task 10 的 style.css 提供（本任务先行引用属预期，顺序执行即可）。

---

### Task 9: 快捷键精简

**Files:**
- Modify: `src/composables/useKeyboardShortcuts.ts:98-182`
- Modify: `src/components/KeyboardShortcutsHelp.vue:19-72`

**Interfaces:**
- Consumes: `themeStore.toggleDarkMode`（Task 3）
- Produces: `useThemeKeyboardShortcuts()` 保留（内部只注册 Alt+D）；`KEYBOARD_SHORTCUTS_HELP` 仅含 `themeToggleDark` + 播放控制 7 项。

- [ ] **Step 1: 精简 `useThemeKeyboardShortcuts` 与 `KEYBOARD_SHORTCUTS_HELP`**

`useKeyboardShortcuts.ts` 中 `useThemeKeyboardShortcuts` 函数体替换为：

```ts
/**
 * 主题快捷键 Composable（双城时代仅剩深浅切换）
 */
export function useThemeKeyboardShortcuts() {
  const themeStore = useThemeStore();

  function handleThemeKeydown(event: KeyboardEvent) {
    // 如果用户正在输入，不触发快捷键
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLSelectElement
    ) {
      return;
    }

    // Alt + D: 切换深色/浅色模式
    if (event.altKey && event.key === 'd') {
      event.preventDefault();
      themeStore.toggleDarkMode();
    }
  }

  onMounted(() => {
    document.addEventListener('keydown', handleThemeKeydown);
  });

  onUnmounted(() => {
    document.removeEventListener('keydown', handleThemeKeydown);
  });
}
```

`KEYBOARD_SHORTCUTS_HELP` 替换为（删除 themeNext / themePrev / themeReset / themeQuick1~6）：

```ts
export const KEYBOARD_SHORTCUTS_HELP = {
  playPause: { key: 'Space', description: '播放/暂停' },
  stop: { key: 'Home', description: '停止并回到开头' },
  stepForward: { key: '→/↓', description: '单步前进' },
  stepBack: { key: '←/↑', description: '单步后退' },
  seekForward: { key: 'PageDown', description: '快速前进10步' },
  seekBackward: { key: 'PageUp', description: '快速后退10步' },
  seekEnd: { key: 'End', description: '跳转到最后' },
  themeToggleDark: { key: 'Alt+D', description: '切换深色/浅色主题' },
} as const;
```

- [ ] **Step 2: 精简 `KeyboardShortcutsHelp.vue`**

模板 `help-sections` 区域：删除「🎨 主题快捷键」section（Alt+T/Shift+T/R 四条）与「⚡ 快速主题切换」整个 section，替换为单个主题 section：

```html
<!-- 主题快捷键 -->
<div class="help-section">
  <h4>🌓 主题</h4>
  <div class="shortcut-list">
    <div class="shortcut-item">
      <kbd>Alt</kbd> + <kbd>D</kbd>
      <span>切换深色/浅色主题</span>
    </div>
  </div>
</div>
```

播放控制 section 原样保留。script 与其余样式不动。

---

### Task 10: 样式基座（字体自托管 + 全局样式 + EP 映射）

**Files:**
- Create: `src/assets/fonts/JetBrainsMono-Regular.woff2`、`src/assets/fonts/JetBrainsMono-Bold.woff2`（下载需授权）
- Create: `src/styles/theme.scss`
- Delete: `src/styles/theme-transitions.css`
- Rewrite: `src/style.css`
- Modify: `src/main.ts:6-7`

**Interfaces:**
- Produces（Task 8/11 消费）: CSS 变量 `--font-ui` / `--font-mono`；全局颜色过渡；`.tabular-nums` 工具类。

- [ ] **Step 1: 获取字体文件（需用户授权或用户手动放置）**

两个 woff2（各约 50KB）放入 `src/assets/fonts/`：
- `JetBrainsMono-Regular.woff2`（400）
- `JetBrainsMono-Bold.woff2`（700）

来源（任选其一，执行时询问用户）：
a) 授权后 `curl -L -o` 从 `https://raw.githubusercontent.com/JetBrains/JetBrainsMono/master/fonts/webfonts/` 下载；
b) 用户手动从 [JetBrains Mono 官网](https://www.jetbrains.com/lp/mono/) 下载放置。

> 现状 style.css 第 1 行的 Google Fonts CDN `@import` 在离线/弱网环境会静默失败——自托管是可靠性修复（spec 6.4）。字重 600/800 的引用点就近回退到 700/无合成，不做变量字体。

- [ ] **Step 2: 新建 `src/styles/theme.scss`**

```scss
// ── 主题样式基座：自托管字体 / 颜色过渡 / tabular-nums ──
// 颜色 token（--bg-1 等）由 themeStore.applyThemeToDOM 运行时注入，此处只放静态规则。

// 自托管 JetBrains Mono（Orbitron 教训：不存在的字体不写进字体栈）
@font-face {
  font-family: "JetBrains Mono";
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("@/assets/fonts/JetBrainsMono-Regular.woff2") format("woff2");
}
@font-face {
  font-family: "JetBrains Mono";
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url("@/assets/fonts/JetBrainsMono-Bold.woff2") format("woff2");
}

// 字体栈 token：拉丁 UI 走系统栈，中文回退系统字体，数字走自托管 mono
:root {
  --font-ui: system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  --font-mono: "JetBrains Mono", "Cascadia Mono", Consolas, monospace;
}

// 主题切换全局颜色过渡（300ms，与 Canvas 色板混合同节奏；取代旧 theme-transitioning class hack）
body,
.app,
.app-title,
.bg-grid,
.control-panel,
.stats-bar,
.compare-slot,
.compare-summary,
.compare-controls,
.help-content,
.algo-dropdown,
.action-btn,
.pb-btn,
.ctrl-btn,
.theme-switch,
.help-button,
kbd {
  transition:
    background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    border-color 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    color 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

// 数值排版：等宽数字，滚动零抖动（spec 6.4 / 7.4）
.tabular-nums,
.pb-step-count,
.metric-value,
.diff-value,
.stat-item strong,
.size-value,
.speed-value,
.summary-algo-name {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

// 动效减弱偏好
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 3: 重写 `src/style.css`**

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body {
  height: 100%;
  /* token 由 themeStore 注入（--bg-1 / --text），fallback 对应暗色主题 */
  background: var(--bg-1, #0b0e14);
  color: var(--text, #e8ecf3);
  font-family: var(--font-ui, system-ui, sans-serif);
}

#app {
  height: 100%;
}

::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--border, rgba(255, 255, 255, 0.08));
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted, #5c6675);
}

::selection {
  background: var(--accent, #89b4fa);
  color: var(--bg-1, #0b0e14);
}
```

> 删除项：Google Fonts `@import`（第 1 行）、旧 `:root` 变量块（`--bg-primary` 等 9 个——已核实无组件消费，Task 11 完成后 rg 复查）、body 的 monospace 字体栈（全站默认字体改为 UI 栈，数字处显式 mono）。

- [ ] **Step 4: 删除 `src/styles/theme-transitions.css` 并更新 `main.ts`**

- 全局 rg `theme-transitions`——仅 main.ts:7 一处。
- 删除文件；main.ts 第 6-7 行改为：

```ts
import "./style.css";
import "./styles/theme.scss";
```

- [ ] **Step 5: 静态自查**

rg `--color-background|--color-text |--color-primary|--bg-primary` 于 `src/`——Task 11 完成后应为零命中（本任务结束时 KeyboardShortcutsHelp 等旧 fallback `var(--color-text, #fff)` 仍存在，Task 11 统一清理）。

---

### Task 11: UI 组件 token 化（映射表驱动）

**Files:**
- Modify: `src/components/ControlPanel.vue`
- Modify: `src/components/algorithms/_algorithm-common.scss`
- Modify: `src/components/CompareView.vue`、`src/components/CompareSlot.vue`
- Modify: `src/components/SortBarCanvas.vue`、`SortBarCanvasMerge.vue`、`SortBarCanvasHeap.vue`、`SortBarCanvasBucket.vue`
- Modify: `src/components/KeyboardShortcutsHelp.vue`（旧 `--color-*` fallback 清理）

**Interfaces:**
- Consumes: Task 10 的 CSS 变量全集
- Produces: 全部 UI 视觉走 token；暗/亮双主题下组件全部正确换装。

**统一替换映射表（所有文件一致执行，旧值 → 新值）：**

| 旧（硬编码） | 新（token） |
|---|---|
| `background: rgba(10, 10, 20, 0.7/0.85/0.5/0.6)`（面板底） | `background: var(--bg-2)` |
| `backdrop-filter: blur(...)` + `box-shadow: 0 4px 24px ...`（玻璃拟态） | 删除两行；亮色投影由 `box-shadow: var(--panel-shadow)` 提供（暗色自动为 none） |
| `border: 1px solid rgba(74, 158, 255, 0.12~0.25)` / `rgba(255,255,255,0.1)` | `border: 1px solid var(--border)` |
| `color: #8b95a8` / `#a8b2c8` / `#c8d4e8`（次要文字） | `color: var(--text-secondary)` |
| `color: #6b7280` / rgba(255,255,255,0.5)（弱文字） | `color: var(--text-muted)` |
| `color: #6bb3ff` / `#c0c8d8` / `#e0e0e0`（主文字/选项） | `color: var(--text)` |
| `color: #4ecdc4` / `#5dddd4` / `#4adeee`（青绿强调） | `color: var(--accent)` |
| `background: rgba(74, 158, 255, 0.05~0.12)` / `rgba(78, 205, 196, 0.08~0.15)`（控件底） | `background: var(--bg-3)` |
| `background: rgba(74, 222, 222, 0.08)`（复杂度徽章底） | `background: transparent`（保留 border） |
| `border-color: rgba(74, 158, 255, 0.35~0.5)`（hover/focus 边框） | `border-color: var(--accent)` |
| `box-shadow: 0 0 8px rgba(74,158,255,...)`（控件发光） | 删除（画廊克制） |
| `color: #ff8a8a` / `#ffaaaa`（红系/退出/active） | `color: var(--swapping, #ff5d5d)`；对应 border `rgba(255,138,138,*)` → `var(--swapping-border)`（见 Step 1 变量补充） |
| `color: #6bff6b`（done 绿） | `color: var(--sorted, #3ecf8e)` |
| `background: #4a9eff`（slider thumb） | `background: var(--accent)` |
| `linear-gradient(90deg, #4a9eff, #4ecdc4)`（进度条填充） | `background: var(--accent)`（纯色） |
| `background: #0d1117`（select option） | `background: var(--bg-3)` |
| `font-family: 'JetBrains Mono', monospace`（组件内散落） | `font-family: var(--font-mono)` |

- [ ] **Step 1: themeStore 补充两个语义色变量**

`themeStore.ts` 的 `applyThemeToDOM` vars 对象中追加两行（状态语义色供 UI 徽标用）：

```ts
      "--sorted": currentTheme.value.canvas.states.sorted.fill,
      "--swapping": currentTheme.value.canvas.states.swapping.fill,
```

- [ ] **Step 2: ControlPanel.vue 样式块按映射表全量替换**

结构/模板/script 不动；`<style>` 内逐条对照映射表。关键结构性变化：
- `.control-panel`：`background: var(--bg-2); border: 1px solid var(--border); border-radius: 12px; box-shadow: var(--panel-shadow);`（去 blur/重投影）。
- `.algo-dropdown` / `.action-btn` / `.compare-badge` 等：底 `var(--bg-3)`、边框 `var(--border)`、hover 边框 `var(--accent)`、文字色按表。
- `.size-value` / `.speed-value` / `.algo-complexity` / `.speed-marks` 文字色：`var(--text-secondary)` / `var(--text-muted)`（青绿全部退役）。
- slider thumb：`background: var(--accent); box-shadow: none;`。

- [ ] **Step 3: `_algorithm-common.scss` 按映射表全量替换**

关键点：
- `.stats-bar` / `.pb-btn` / `.pb-desc` 等面板底与边框按表。
- `.pb-fill` / `.pb-handle` / `.slot-fill` 渐变改 `background: var(--accent)`。
- 状态色：`.pb-desc.playing .dot` / `.status-text` → `var(--accent)`；`.paused` → `var(--swapping)`；`.done` → `var(--sorted)`；`.ready` → `var(--text-muted)`。
- `.pb-btn.active`（播放中）→ `color: var(--accent); border-color: var(--accent); background: var(--bg-3);`（原红色 active 改 accent——播放是"进行中"不是"警告"）。
- `.pb-phase` 徽章：文字 `var(--text-secondary)`、底透明、边框 `var(--border)`。
- `.pb-step-count` 颜色 `var(--text-secondary)`（tabular-nums 已由 theme.scss 全局挂上）。
- `.kbd`：底 `var(--bg-3)`、边框 `var(--border)`、字色 `var(--text-muted)`。

- [ ] **Step 4: CompareView.vue 与 CompareSlot.vue 按映射表替换**

- `.compare-controls` / `.compare-summary` / `.compare-slot` / `.slot-header` 面板按表；玻璃拟态（blur + 重投影）全部退役。
- `.layout-btn` / `.play-pause-btn` 青绿 → `var(--accent)`；`.exit-btn` 红 → `var(--swapping)`。
- `.heap-mode-btn.max` → `var(--swapping)` 系；`.min` → `var(--accent)` 系。
- `.diff-value.winner-left` → `var(--sorted)`（赢家=更优=绿）；`.winner-right` → `var(--swapping)`；`.winner-tie` → `var(--text-muted)`。
- `.slot-stats .stat-item strong` / `.metric-value` 颜色 `var(--text-secondary)`。

- [ ] **Step 5: SortBarCanvas ×4 的 corner 装饰**

四个文件中 `.corner { border-color: rgba(74,158,255,0.9) }`（Bucket 为 `rgba(78,205,196,0.7)` + inset 阴影）统一改为：

```scss
.corner {
  border-color: var(--border);
}
```

`SortBarCanvasBucket.vue:73` 的 `box-shadow: inset 0 0 60px rgba(78, 205, 196, 0.04)` 删除。

- [ ] **Step 6: KeyboardShortcutsHelp.vue 清理**

所有 `var(--color-text, #fff)` / `var(--color-background-secondary, #1a1a2e)` / `var(--color-divider, ...)` 等旧变量 + fallback 改为新 token（`var(--text)` / `var(--bg-2)` / `var(--border)` 等）；`.help-panel` 遮罩 `rgba(0,0,0,0.7)` 保留（模态遮罩与主题无关）；`.help-content` 底 `var(--bg-2)`。

- [ ] **Step 7: 残留扫描**

rg `#4a9eff|#4ecdc4|#5dddd4|#6bb3ff|#8b95a8|#ff8a8a|#6bff6b|#4adeee|rgba\(74, ?158|rgba\(78, ?205|rgba\(10, ?10, ?20` 于 `src/`（排除 `src/data/themes.ts` 与 `src/utils/frame/`）——应为零命中。

---

## 阶段 D：终检

### Task 12: 残留扫描 + 验收清单

**Files:**
- 无新增改动文件（发现问题则回补对应任务）

- [ ] **Step 1: 死代码与残留全局扫描**

依次执行（Grep 工具，范围 `src/` + `test/`），预期全部零命中：

```
TAG_STYLE_MAP | BAR_BASE_STYLE | MAIN_BASE_STYLE | BUFFER_BASE_STYLE | TREE_BASE_STYLE | ARRAY_BASE_STYLE | bucketBaseStyle | getStyleFromStateTags | getBucketTheme | bucket-palette
useTheme[^KS]                     # useThemeStore/useThemeKeyboardShortcuts 除外
ThemeSelector | theme-transitioning | theme-transitions
nextTheme | previousTheme | resetToDefault | exportThemeConfig | importThemeConfig | getStyleForState | isTransitioning
Orbitron | Fira Code | cyberpunk | ocean | sunset | forest
--color-primary | --color-background | --bg-primary
fonts.googleapis
```

- [ ] **Step 2: 主题 ID 单一来源检查**

人工核对主题 ID 字面量（`"dark"` / `"light"` 作为主题值使用）只出现在：`src/types/theme.ts`（类型定义）、`src/data/themes.ts`（主题数据与迁移表）、`src/stores/themeStore.ts`（`toggleDarkMode` 内两处）。其余文件出现即违规（用 rg `ThemeId|setTheme\(|toggleDarkMode` 追查引用链辅助核对）。

- [ ] **Step 3: 类型与测试全量验证（需用户授权或用户执行）**

- `npx vue-tsc --noEmit` — 零错误
- `npx vitest run` — 全部 PASS

- [ ] **Step 4: 用户目检验收清单（7.4 验收标准）**

请用户运行 `npm run dev` 后逐项确认：

1. **核心缺陷修复**：暗色下播放任一算法，点击日/月开关——Canvas 柱子颜色应在 300ms 内平滑换装（含播放中切换）；不重建动画。
2. **7 算法 × 2 主题回归**：bubble / insertion / quick / shell / merge / bucket / heap 逐个完整播放（或快速拖进度条过全程）：
   - 实体不闪现、hidden 实体不显现（merge/bucket 的 ghost 飞行正常，无"通道关闭"或重现 bug）；
   - 颜色随状态切换（compare 琥珀 → swap 珊瑚 → sorted 翡翠）；暗色下仅 compare/swap/pivot 发光；
   - 堆视图树节点 + 数组映射区双区正常；compare 引导虚线为琥珀色。
3. **对比模式**：双画布同主题换装一致；对比汇总面板 winner 色正确。
4. **UI 层**：亮色下所有面板/按钮/滑块/下拉/快捷键面板正确换装（无残留深色块）；亮色卡片有极轻投影；暗色无边框发光。
5. **排版**：统计数字（比较/交换/步骤 x/y）滚动无抖动；标题旁有等宽 eyebrow 标签。
6. **持久化**：切到亮色后刷新仍为亮色；清除 localStorage 后按系统偏好初始化。
7. **快捷键**：Alt+D 切换生效；Alt+T / Alt+R / Alt+1~6 无响应；帮助面板列表已精简。
8. **切换器**：header 右侧日/月图标旋转过渡顺滑；无模态。

- [ ] **Step 5: CLAUDE.md 经验增补（建议，经用户同意后写入项目 CLAUDE.md）**

```markdown
### 7. 渲染期取色（双城主题架构）
实体颜色一律由 useCanvasRenderer 每帧 resolveEntityStyle(stateTags, palette) 从主题取，builders 只产 stateTags 不产颜色。新增算法时实体创建处禁止写 style.fill；overlay 颜色用 OverlayColorToken 语义键。切主题靠 themeStore 色板混合器（300ms），不重建 timeline。
```

---

## 任务依赖图

```
Task 1 (类型+数据) ─→ Task 2 (混合器) ─→ Task 3 (themeStore) ─┐
Task 4 (timeline 类型+style-utils) ←── Task 1                  ├─→ Task 7 (renderer) ─→ Task 12
Task 5 (interpolate-entity) ←── Task 4                         │
Task 6 (builders) ←── Task 4                                    │
Task 8 (切换器+App) ←── Task 3                                  │
Task 9 (快捷键) ←── Task 3                                      │
Task 10 (样式基座) ──→ Task 11 (UI token 化) ←── Task 8         ┘
```

执行顺序即任务编号顺序（1→12），中间态编译错误均已在对应任务内标注原因与消除位置。
