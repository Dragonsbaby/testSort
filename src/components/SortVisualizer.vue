<script setup lang="ts">
import { ref, computed } from "vue";
import { useSortStore } from "@/stores/sortStore";
import AlgorithmView from "@/components/algorithms/AlgorithmView.vue";
import CompareView from "@/components/CompareView.vue";

const store = useSortStore();
const algorithmRef = ref<InstanceType<typeof AlgorithmView> | null>(null);

const isCompareMode = computed(() => store.viewMode === 'compare');

function reset() {
  algorithmRef.value?.reset();
}

function step() {
  algorithmRef.value?.step();
}

defineExpose({ reset, step });
</script>

<template>
  <div class="visualizer">
    <!-- :key 保证切换算法即重挂载（useSortAnimation 的 algorithm 参数为挂载期常量） -->
    <AlgorithmView
      v-if="!isCompareMode"
      :key="store.algorithm"
      ref="algorithmRef"
      :algorithm="store.algorithm"
      :speed="store.animationSpeed"
    />
    <CompareView v-else />
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
