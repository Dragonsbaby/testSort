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
  | "bucket-gather";

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
  | "latest";

export interface RenderStyle {
  fill: string;
  stroke?: string;
  text?: string;
  glow?: number;
  dashed?: boolean;
  alpha?: number;
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
  style: RenderStyle;
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
  kind: "edge" | "guide" | "label" | "badge" | "divider";
  points?: Array<{ x: number; y: number }>;
  text?: string;
  style: RenderStyle;
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
