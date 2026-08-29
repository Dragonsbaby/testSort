import type { SortAlgorithm } from "@/types/sorting";

export type SemanticStepType =
  | "compare"
  | "swap"
  | "merge"
  | "set"
  | "sorted"
  | "pivot"
  | "merge-set"
  | "merge-back"
  | "bucket-scatter"
  | "bucket-compare"
  | "bucket-swap"
  | "bucket-gather"
  | "latest";

/** 步骤上下文信息：提供算法阶段和进度信息 */
export interface StepContext {
  /** 算法阶段：如"分区阶段"、"合并阶段"、"建堆阶段" */
  phase: string;
  /** 递归深度（快速排序、归并排序） */
  depth?: number;
  /** 当前迭代次数 */
  iteration?: number;
  /** 整体进度百分比 */
  progress?: number;
  /** 学习提示：解释为什么这样做 */
  hint?: string;
  /** 用于进度条标记 */
  importance?: 'low' | 'medium' | 'high';
  /** 桶排序专用：当前桶索引 */
  bucketIndex?: number;
  /** 桶排序专用：桶的值域范围 */
  valueRange?: string;
  /** 桶排序专用：桶信息 */
  bucketInfo?: string;
  /** 堆排序专用：当前堆范围 */
  heapRange?: number;
  /** 希尔排序专用：当前间隔值 */
  gap?: number;
  /** 插入排序专用：当前插入目标区间 */
  targetRange?: string;
  /** 希尔排序专用：同组索引（与顶层 groupIndices 同源） */
  groupIndices?: number[];
  /** 桶排序专用：收集阶段进度百分比 */
  totalProgress?: number;
}

export interface SemanticStep {
  type: SemanticStepType;
  indices: number[];
  description: string;
  arraySnapshot?: number[];
  gap?: number;
  groupIndices?: number[];
  tempSnapshot?: (number | null)[];
  bucketIndex?: number;
  bucketPos?: number;

  // === 三层描述系统 ===
  /** 简洁层：一句话说明操作 */
  brief?: string;
  /** 详细层：操作原因和预期结果 */
  detail?: string;
  /** 上下文：算法阶段和进度信息 */
  context?: StepContext;
}

export type FramePhase = "idle" | "playing" | "paused" | "completed";

export type EntityKind =
  | "main-bar"
  | "buffer-bar"
  | "bucket-bar"
  | "heap-tree-node"
  | "heap-array-node"
  | "ghost-bar";

export type StateTag =
  | "comparing"
  | "swapping"
  | "sorted"
  | "pivot"
  | "pending"
  | "heap-pending"
  | "latest";

/** 实体非主题属性：虚线与透明度。颜色/发光一律由渲染期 resolveEntityStyle 从主题取（spec 5.1） */
export interface RenderStyle {
  dashed?: boolean;
  alpha?: number;
}

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

export interface RenderableEntity {
  id: string;
  sourceId: string;
  kind: EntityKind;
  value: number;
  displayIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  zIndex: number;
  /** 非主题属性（dashed/alpha）；builders 可不传，颜色由渲染期取色 */
  style?: RenderStyle;
  stateTags: StateTag[];
}

export interface RenderableRegion {
  id: string;
  kind: "main" | "buffer" | "bucket" | "heap-tree" | "heap-array";
  x: number;
  y: number;
  width: number;
  height: number;
  meta?: Record<string, number | string>;
}

export interface RenderableOverlay {
  id: string;
  kind: "edge" | "guide" | "label" | "badge" | "divider" | "region-panel";
  points?: Array<{ x: number; y: number }>;
  text?: string;
  style: OverlayStyle;
  /** 用于 region-panel：圆角矩形尺寸 */
  rect?: { x: number; y: number; width: number; height: number; radius: number };
  /** 活跃桶顶部高亮条（accent 色） */
  accentBar?: boolean;
}

export interface FrameState {
  algorithm: SortAlgorithm;
  stepIndex: number;
  progress: number;
  phase: FramePhase;
  description: string;
  entities: RenderableEntity[];
  regions: RenderableRegion[];
  overlays: RenderableOverlay[];
}

export interface Transition {
  type: "instant" | "linear" | "arc" | "path" | "fade";
  duration: number;
  easing: "linear" | "easeOutCubic" | "easeInOutCubic";
  movingEntityIds?: string[];
  pathParams?: Record<string, number | string>;
  styleTransition?: boolean;
  visibilityTransition?: boolean;
  /** 需要交叉插值的 entity id 对，每对 [idA, idB] 表示 A 从 B 的起始位置飞向 A 的目标位置，B 同理 */
  swapEntityIdPairs?: [string, string][];
}

export interface TimelineStep {
  id: string;
  kind: SemanticStepType;
  description: string;
  duration: number;
  from: FrameState;
  to: FrameState;
  transition: Transition;
  statsDelta: {
    comparisons: number;
    swaps: number;
  };
  semanticRef?: SemanticStep;
}
