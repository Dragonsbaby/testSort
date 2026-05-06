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
const BOTTOM_PADDING = 28;
const BASELINE_RATIO = 0.76;

export function buildBasicLayout({ width, height, count }: BasicLayoutInput): BasicBarSlot[] {
  if (count <= 0) return [];

  const barWidth = Math.max(MIN_BAR_WIDTH, Math.min(MAX_BAR_WIDTH, (width - GAP) / count - GAP));
  const totalWidth = count * barWidth + (count - 1) * GAP;
  const startX = Math.max(0, (width - totalWidth) / 2);
  const labelSafeBaseY = height - BOTTOM_PADDING - BASIC_LAYOUT_LABEL_OFFSET;
  const baseY = Math.min(Math.round(height * BASELINE_RATIO), labelSafeBaseY);
  const maxHeight = Math.max(0, baseY - TOP_PADDING);

  return Array.from({ length: count }, (_, index) => ({
    index,
    x: Math.round(startX + index * (barWidth + GAP)),
    y: Math.round(baseY),
    width: Math.round(barWidth),
    maxHeight: Math.round(maxHeight),
  }));
}
