import { ref, type Ref } from "vue";
import { useCanvasRenderer } from "@/composables/useCanvasRenderer";
import type { FrameState } from "@/types/timeline";

export function useBucketSortRenderer(canvasRef: Ref<HTMLCanvasElement | null>) {
  const renderer = useCanvasRenderer(canvasRef);
  const currentFrame = ref<FrameState | null>(null);

  function renderFrame(frame: FrameState) {
    currentFrame.value = frame;
    renderer.renderFrame(frame);
  }

  return {
    currentFrame,
    initialize: renderer.initialize,
    resize: renderer.resize,
    renderFrame,
    startRenderLoop: renderer.startRenderLoop,
    stopRenderLoop: renderer.stopRenderLoop,
  };
}
