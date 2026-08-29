import type { SortAlgorithm } from "@/types/sorting";

/** Canvas 壳变体：决定容器/画布最小高度与布局细节（见 SortBarCanvas.vue 的 CANVAS_SPEC） */
export type CanvasVariant = "basic" | "merge" | "heap" | "bucket";

/** 算法 → Canvas 变体映射（算法视图与 CompareSlot 共用） */
export const CANVAS_VARIANT_BY_ALGORITHM: Record<SortAlgorithm, CanvasVariant> = {
  bubble: "basic",
  insertion: "basic",
  quick: "basic",
  shell: "basic",
  merge: "merge",
  bucket: "bucket",
  heap: "heap",
};
