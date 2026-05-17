/**
 * Vitest 测试环境设置
 */

import { vi } from 'vitest';

// Mock requestAnimationFrame
global.requestAnimationFrame = (callback: FrameRequestCallback) => {
  return setTimeout(callback, 16) as unknown as number;
};

global.cancelAnimationFrame = (id: number) => {
  clearTimeout(id);
};

// Mock performance API
global.performance = {
  ...global.performance,
  now: () => Date.now()
};

// Mock Canvas API
const mockCanvasContext = {
  fillRect: vi.fn(),
  clearRect: vi.fn(),
  fillText: vi.fn(),
  strokeText: vi.fn(),
  beginPath: vi.fn(),
  closePath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  quadraticCurveTo: vi.fn(),
  bezierCurveTo: vi.fn(),
  arc: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  scale: vi.fn(),
  createLinearGradient: vi.fn(() => ({
    addColorStop: vi.fn()
  })),
  createRadialGradient: vi.fn(() => ({
    addColorStop: vi.fn()
  })),
  fill: vi.fn(),
  stroke: vi.fn(),
  drawImage: vi.fn(),
  getImageData: vi.fn(() => ({
    data: new Uint8ClampedArray(0)
  })),
  putImageData: vi.fn(),
  setLineDash: vi.fn(),
  getLineDash: vi.fn(() => []),
  clip: vi.fn(),
  measureText: vi.fn(() => ({ width: 0 })),
  transform: vi.fn(),
  setTransform: vi.fn(),
  resetTransform: vi.fn(),
  isPointInPath: vi.fn(() => false),
  isPointInStroke: vi.fn(() => false)
};

// Mock Canvas 元素
global.HTMLCanvasElement.prototype.getContext = vi.fn((contextType: string) => {
  if (contextType === '2d') {
    return mockCanvasContext as any;
  }
  return null;
});

global.HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn(() => ({
  x: 0,
  y: 0,
  width: 760,
  height: 460,
  top: 0,
  left: 0,
  bottom: 460,
  right: 760,
  toJSON: () => ({})
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}));

console.log('✅ Vitest 环境设置完成');
