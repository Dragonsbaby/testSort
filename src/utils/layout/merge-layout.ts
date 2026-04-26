import { buildBasicLayout } from "./basic-layout";

export interface MergeLayout {
  topSlots: ReturnType<typeof buildBasicLayout>;
  bottomSlots: ReturnType<typeof buildBasicLayout>;
  dividerY: number;
}

export function buildMergeLayout(width: number, height: number, count: number): MergeLayout {
  const dividerY = Math.floor(height * 0.5);

  return {
    topSlots: buildBasicLayout({ width, height: dividerY - 18, count }),
    bottomSlots: buildBasicLayout({ width, height: height - dividerY - 18, count }).map((slot) => ({
      ...slot,
      y: slot.y + dividerY + 18,
    })),
    dividerY,
  };
}
