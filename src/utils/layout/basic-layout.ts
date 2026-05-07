export interface BasicLayoutInput {
  width: number;
  height: number;
  count: number;
}

export interface BasicBarSlot {
  index: number;
  x: number;
  y: number;
  width: number;
  maxHeight: number;
}

export const BASIC_LAYOUT_LABEL_OFFSET = 17;

const GAP = 12;
const MIN_BAR_WIDTH = 6;
const MAX_BAR_WIDTH = 46;
const TOP_PADDING = 48;
// 水平线到底部的空间 = labelOffset(17) + 字体高度(12) + 少量边距(4)
const BOTTOM_PADDING = 33;

export function buildBasicLayout({ width, height, count }: BasicLayoutInput): BasicBarSlot[] {
  if (count <= 0) return [];

  const barWidth = Math.max(MIN_BAR_WIDTH, Math.min(MAX_BAR_WIDTH, (width - GAP) / count - GAP));
  const totalBarWidth = count * barWidth;
  const dynamicGap = count > 1
    ? Math.max(2, Math.min(GAP, (width - totalBarWidth) / (count - 1)))
    : 0;
  const totalWidth = totalBarWidth + (count - 1) * dynamicGap;
  const startX = Math.max(0, (width - totalWidth) / 2);
  // baseY = 水平线位置，底部仅留序号标签空间
  const baseY = height - BOTTOM_PADDING - BASIC_LAYOUT_LABEL_OFFSET;
  const maxHeight = Math.max(0, baseY - TOP_PADDING);

  return Array.from({ length: count }, (_, index) => ({
    index,
    x: Math.round(startX + index * (barWidth + dynamicGap)),
    y: Math.round(baseY),
    width: Math.round(barWidth),
    maxHeight: Math.round(maxHeight),
  }));
}
