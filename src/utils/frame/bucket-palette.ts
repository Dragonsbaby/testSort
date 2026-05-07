/** 每个桶的视觉主题配色 */
export interface BucketTheme {
  /** 边框颜色（也用于柱子主色） */
  border: string;
  /** 柱子主色（同 border，方便单独引用） */
  bar: string;
  /** 柱子发光颜色 */
  barGlow: string;
  /** 桶面板半透明背景填充 */
  bgFill: string;
  /** 边框外发光颜色 */
  borderGlow: string;
  /** 徽章背景 */
  badgeBg: string;
  /** 徽章文字颜色 */
  badgeText: string;
}

/** 9 种循环配色（索引 0–8） */
export const BUCKET_PALETTE: BucketTheme[] = [
  {
    border: "#4ecdc4",
    bar: "#4ecdc4",
    barGlow: "#4ecdc4",
    bgFill: "rgba(78, 205, 196, 0.055)",
    borderGlow: "#4ecdc4",
    badgeBg: "rgba(78, 205, 196, 0.18)",
    badgeText: "#d7fffb",
  },
  {
    border: "#b979ff",
    bar: "#b979ff",
    barGlow: "#b979ff",
    bgFill: "rgba(185, 121, 255, 0.055)",
    borderGlow: "#b979ff",
    badgeBg: "rgba(185, 121, 255, 0.18)",
    badgeText: "#f0e0ff",
  },
  {
    border: "#ffaa4e",
    bar: "#ffaa4e",
    barGlow: "#ffaa4e",
    bgFill: "rgba(255, 170, 78, 0.055)",
    borderGlow: "#ffaa4e",
    badgeBg: "rgba(255, 170, 78, 0.18)",
    badgeText: "#fff3d7",
  },
  {
    border: "#ff6b8a",
    bar: "#ff6b8a",
    barGlow: "#ff6b8a",
    bgFill: "rgba(255, 107, 138, 0.055)",
    borderGlow: "#ff6b8a",
    badgeBg: "rgba(255, 107, 138, 0.18)",
    badgeText: "#ffe0ea",
  },
  {
    border: "#4ab0ff",
    bar: "#4ab0ff",
    barGlow: "#4ab0ff",
    bgFill: "rgba(74, 176, 255, 0.055)",
    borderGlow: "#4ab0ff",
    badgeBg: "rgba(74, 176, 255, 0.18)",
    badgeText: "#d7f0ff",
  },
  {
    border: "#5dde8a",
    bar: "#5dde8a",
    barGlow: "#5dde8a",
    bgFill: "rgba(93, 222, 138, 0.055)",
    borderGlow: "#5dde8a",
    badgeBg: "rgba(93, 222, 138, 0.18)",
    badgeText: "#d7ffe8",
  },
  {
    border: "#ff79c6",
    bar: "#ff79c6",
    barGlow: "#ff79c6",
    bgFill: "rgba(255, 121, 198, 0.055)",
    borderGlow: "#ff79c6",
    badgeBg: "rgba(255, 121, 198, 0.18)",
    badgeText: "#ffe0f5",
  },
  {
    border: "#f0d050",
    bar: "#f0d050",
    barGlow: "#f0d050",
    bgFill: "rgba(240, 208, 80, 0.055)",
    borderGlow: "#f0d050",
    badgeBg: "rgba(240, 208, 80, 0.18)",
    badgeText: "#fffae0",
  },
  {
    border: "#50e3c2",
    bar: "#50e3c2",
    barGlow: "#50e3c2",
    bgFill: "rgba(80, 227, 194, 0.055)",
    borderGlow: "#50e3c2",
    badgeBg: "rgba(80, 227, 194, 0.18)",
    badgeText: "#d7fff8",
  },
];

/**
 * 根据桶索引获取主题（超出范围循环取用）
 */
export function getBucketTheme(bucketIndex: number): BucketTheme {
  return BUCKET_PALETTE[bucketIndex % BUCKET_PALETTE.length];
}
