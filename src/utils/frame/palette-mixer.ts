import type { RendererPalette } from "@/types/theme";

/** 6 位 hex → rgb 三元组 */
function hexToRgb(hex: string): [number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

function channelToHex(value: number): string {
  return Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, "0");
}

/** 两个 6 位 hex 之间的每通道线性插值 */
export function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return `#${channelToHex(ar + (br - ar) * t)}${channelToHex(ag + (bg - ag) * t)}${channelToHex(ab + (bb - ab) * t)}`;
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** 参与混合的 hex 字段（rgba 字符串字段不在此列） */
const MIXED_HEX_FIELDS = [
  "background", "backgroundSecondary", "text", "indexText",
  "accent", "uiText", "uiTextSecondary", "uiTextMuted",
] as const;

/**
 * 渲染调色板混合（spec 5.3）：
 * - hex 字段每通道 lerp；states 的 fill 同理、glow 与 shadowBlur 数值 lerp；
 * - grid / gridSpacing / baseline / border 直接取 to（rgba 字符串不解析，切换瞬间跳变无视觉影响）。
 */
export function mixRendererPalette(from: RendererPalette, to: RendererPalette, t: number): RendererPalette {
  const result: RendererPalette = {
    ...to,
    shadowBlur: from.shadowBlur + (to.shadowBlur - from.shadowBlur) * t,
    states: { ...to.states },
  };

  for (const field of MIXED_HEX_FIELDS) {
    result[field] = mixHex(from[field], to[field], t);
  }

  for (const tag of Object.keys(to.states) as Array<keyof RendererPalette["states"]>) {
    const fromState = from.states[tag] ?? to.states[tag];
    result.states[tag] = {
      fill: mixHex(fromState.fill, to.states[tag].fill, t),
      glow: fromState.glow + (to.states[tag].glow - fromState.glow) * t,
    };
  }

  return result;
}
