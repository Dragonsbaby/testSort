import { calcBucketCount } from "@/types/sorting";

export interface BucketRegion {
  bucketIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BucketLayout {
  bucketCount: number;
  mainHeight: number;
  separatorHeight: number;
  bucketRegions: BucketRegion[];
}

export function buildBucketLayout(width: number, height: number, count: number): BucketLayout {
  const bucketCount = calcBucketCount(count);
  const mainHeight = Math.round(height * 0.33);
  const separatorHeight = Math.round(height * 0.09);
  const top = mainHeight + separatorHeight;
  const gap = 14;
  const bucketWidth = Math.floor((width - gap * (bucketCount + 1)) / bucketCount);

  return {
    bucketCount,
    mainHeight,
    separatorHeight,
    bucketRegions: Array.from({ length: bucketCount }, (_, bucketIndex) => ({
      bucketIndex,
      x: gap + bucketIndex * (bucketWidth + gap),
      y: top,
      width: bucketWidth,
      height: height - top - 8,
    })),
  };
}
