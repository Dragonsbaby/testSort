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
    <component
      :is="currentComponent"
      ref="algorithmRef"
      :is-playing="store.isPlaying"
      :speed="store.animationSpeed"
    />
  </div>
</template>

<style scoped>
.visualizer {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
  border-radius: 12px;
  padding: 20px;
  min-height: 400px;
  overflow: hidden;
}
</style>
