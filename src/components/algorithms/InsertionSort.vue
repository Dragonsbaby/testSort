<script setup lang="ts">
import { ref } from "vue";
import BasicSortView from "./BasicSortView.vue";
import { insertionSort } from "@/utils/sortingAlgorithms";

defineProps<{ speed: number }>();

const viewRef = ref<InstanceType<typeof BasicSortView> | null>(null);

// 透传 reset/step 给 SortVisualizer（其 algorithmRef 指向薄壳，非 BasicSortView）
defineExpose({
  reset: () => viewRef.value?.reset(),
  step: () => viewRef.value?.step(),
});
</script>

<template>
  <BasicSortView ref="viewRef" :sort-fn="insertionSort" algorithm="insertion" :speed="speed" />
</template>
