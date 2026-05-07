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

/** 桶内顶部留白（标题 + 值域标签区域） */
export const BUCKET_INNER_PADDING_TOP = 40;
/** 桶内底部留白（index 标签区域） */
export const BUCKET_INNER_PADDING_BOT = 24;
/** 桶内左右 padding */
export const BUCKET_INNER_PADDING_X = 8;

export function buildBucketLayout(width: number, height: number, count: number): BucketLayout {
  const bucketCount = calcBucketCount(count);
  const mainHeight = Math.round(height * 0.42);
  const separatorHeight = Math.round(height * 0.07);
  const top = mainHeight + separatorHeight;
  const gap = 10;
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
