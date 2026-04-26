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

const GAP = 4;
const MIN_BAR_WIDTH = 4;
const MAX_BAR_WIDTH = 60;
const BOTTOM_OFFSET = 20;
const TOP_PADDING = 40;

export function buildBasicLayout({ width, height, count }: BasicLayoutInput): BasicBarSlot[] {
  if (count <= 0) return [];

  const barWidth = Math.max(MIN_BAR_WIDTH, Math.min(MAX_BAR_WIDTH, (width - GAP) / count - GAP));
  const totalWidth = count * barWidth + (count - 1) * GAP;
  const startX = Math.max(0, (width - totalWidth) / 2);
  const baseY = height - BOTTOM_OFFSET;
  const maxHeight = Math.max(0, height - TOP_PADDING - BOTTOM_OFFSET);

  return Array.from({ length: count }, (_, index) => ({
    index,
    x: Math.round(startX + index * (barWidth + GAP)),
    y: Math.round(baseY),
    width: Math.round(barWidth),
    maxHeight: Math.round(maxHeight),
  }));
}
