export function getHeapRequiredHeight(count: number) {
  if (count <= 1) return 48 + 80 + 88;
  const maxDepth = Math.floor(Math.log2(count));
  return 48 + (maxDepth + 1) * 90 + 88;
}

export function buildHeapNodePosition(index: number, count: number, width: number, height: number) {
  const depth = Math.floor(Math.log2(index + 1));
  const maxDepth = Math.floor(Math.log2(Math.max(count, 1)));
  const levelCount = Math.pow(2, depth);
  const positionInLevel = index - (Math.pow(2, depth) - 1);
  const topPadding = 48;
  const bottomPadding = 88;
  const treeHeight = height - topPadding - bottomPadding;
  const y = maxDepth === 0 ? topPadding + treeHeight / 2 : topPadding + 16 + (depth / maxDepth) * (treeHeight - 32);
  const cellWidth = (width - 80) / levelCount;
  const x = 40 + positionInLevel * cellWidth + cellWidth / 2;
  return { x, y };
}
