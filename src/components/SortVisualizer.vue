<script setup lang="ts">
import { ref, computed } from "vue";
import { useSortStore } from "@/stores/sortStore";
import {
  BubbleSort,
  InsertionSort,
  MergeSort,
  QuickSort,
} from "@/components/algorithms";

const store = useSortStore();
const algorithmRef = ref<InstanceType<typeof MergeSort> | null>(null);

const componentMap = {
  bubble: BubbleSort,
  insertion: InsertionSort,
  merge: MergeSort,
  quick: QuickSort,
} as const;

const currentComponent = computed(
  () => componentMap[store.algorithm] ?? MergeSort,
);

function reset() {
  algorithmRef.value?.reset();
}

function step() {
  algorithmRef.value?.step();
}

defineExpose({ reset, step });
</script>

<template>
  <div class="visualizer" ref="containerRef">
    <div class="visualizer-inner">
      <component
        :is="currentComponent"
        ref="algorithmRef"
        :speed="store.animationSpeed"
      />
    </div>
    <div class="corner top-left"></div>
    <div class="corner top-right"></div>
    <div class="corner bottom-left"></div>
    <div class="corner bottom-right"></div>
  </div>
</template>

<style scoped>
.visualizer {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: linear-gradient(145deg, #0a0a14 0%, #0d1117 50%, #0a0a14 100%);
  border-radius: 12px;
  padding: 20px;
  min-height: 450px;
  position: relative;
  border: 1px solid rgba(74, 158, 255, 0.1);
}

.visualizer-inner {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 1;
}

/* Corner brackets */
.corner {
  position: absolute;
  width: 20px;
  height: 20px;
  border-color: rgba(74, 158, 255, 0.4);
  border-style: solid;
  border-width: 0;
  z-index: 2;
}

.corner.top-left {
  top: 8px;
  left: 8px;
  border-top-width: 2px;
  border-left-width: 2px;
  border-top-left-radius: 4px;
}

.corner.top-right {
  top: 8px;
  right: 8px;
  border-top-width: 2px;
  border-right-width: 2px;
  border-top-right-radius: 4px;
}

.corner.bottom-left {
  bottom: 8px;
  left: 8px;
  border-bottom-width: 2px;
  border-left-width: 2px;
  border-bottom-left-radius: 4px;
}

.corner.bottom-right {
  bottom: 8px;
  right: 8px;
  border-bottom-width: 2px;
  border-right-width: 2px;
  border-bottom-right-radius: 4px;
}
</style>