<script setup lang="ts">
import { ref, computed } from "vue";
import { useSortStore } from "@/stores/sortStore";
import {
  BubbleSort,
  InsertionSort,
  MergeSort,
  QuickSort,
  ShellSort,
} from "@/components/algorithms";

const store = useSortStore();
const algorithmRef = ref<InstanceType<typeof MergeSort> | null>(null);

const componentMap = {
  bubble: BubbleSort,
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