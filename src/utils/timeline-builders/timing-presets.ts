/**
 * 排序动画的时长（帧）/ 弧度 预设。
 * 集中各 timeline builder 的魔法数，便于统一调整动画节奏。
 *
 * 说明：
 * - swap 时长在 basic / heap / bucket 三算法一致（3），故共用 TIMING.swap。
 * - compare 时长仅 heap 使用（2）；basic/bucket 的 compare 走即时（1）。
 * - bucket 与 merge 的飞行时长刻意不同（bucket=2 更快、merge=3），
 *   因两算法的飞行距离与视觉节奏不同，未强行统一。
 */
export const TIMING = {
  /** swap 动画时长（basic / heap / bucket 一致） */
  swap: 3,
  /** compare 动画时长（heap 用 2） */
  compare: 2,
} as const;

/** 各算法专属飞行时长（bucket / merge 节奏不同，未统一） */
export const FLY_DURATION = {
  bucket: 2,
  merge: 3,
} as const;

/** arc 飞行路径的弧高（bucket scatter/gather 用） */
export const CURVE = {
  height: 70,
} as const;
