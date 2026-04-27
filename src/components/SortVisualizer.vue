<script setup lang="ts">
import { ref, computed } from "vue";
import { useSortStore } from "@/stores/sortStore";
import {
  BubbleSort,
  BucketSort,
  HeapSort,
  InsertionSort,
  MergeSort,
  QuickSort,
  ShellSort,
} from "@/components/algorithms";

interface SortAlgorithmExposed {
  reset(): void;
  step(): void;
}

const store = useSortStore();
const algorithmRef = ref<SortAlgorithmExposed | null>(null);

const componentMap = {
  bubble: BubbleSort,
  bucket: BucketSort,
  heap: HeapSort,
  insertion: InsertionSort,
  merge: MergeSort,
  quick: QuickSort,
  shell: ShellSort,
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
    <component
      :is="currentComponent"
      ref="algorithmRef"
      :speed="store.animationSpeed"
    />
  </div>
</template>

<style lang="scss" scoped>
.visualizer {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 400px;
  position: relative;
}
</style>