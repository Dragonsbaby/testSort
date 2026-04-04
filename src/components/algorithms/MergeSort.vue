<script setup lang="ts">
import { ref, watch, onMounted, computed } from "vue";
import { mergeSort } from "@/utils/sortingAlgorithms";
import type { SortStep } from "@/types/sorting";
import SortBarCanvas from "@/components/SortBarCanvas.vue";
import { useSortStore } from "@/stores/sortStore";

const props = defineProps<{
  isPlaying: boolean;
  speed: number;
}>();

const store = useSortStore();

const array = ref<number[]>([]);
const steps = ref<SortStep[]>([]);
const currentStep = ref(0);
const comparisons = ref(0);
const swaps = ref(0);
const localPlaying = ref(false);
const canvasRef = ref<InstanceType<typeof SortBarCanvas> | null>(null);
let timer: ReturnType<typeof setTimeout> | null = null;

const highlightedIndices = computed(() => {
  if (currentStep.value <= 0 || currentStep.value > steps.value.length) {
    return { comparing: [], swapping: [], sorted: [], pivot: [] };
  }
  const step = steps.value[currentStep.value - 1];
  const sortedIndices = new Set<number>();
  for (let i = 0; i < currentStep.value; i++) {
    if (steps.value[i].type === "sorted") {
      steps.value[i].indices.forEach((idx) => sortedIndices.add(idx));
    }
  }
  let comparing: number[] = [];
  let swapping: number[] = [];
  let pivot: number[] = [];
  switch (step.type) {
    case "compare":
      comparing = step.indices;
      break;
    case "swap":
    case "merge":
      swapping = step.indices;
      break;
    case "pivot":
      pivot = step.indices;
      break;
    case "set":
      swapping = step.indices;
      break;
  }
  return {
    comparing,
    swapping,
    sorted: Array.from(sortedIndices),
    pivot,
  };
});

const currentStepInfo = computed(() => {
  if (currentStep.value <= 0 || currentStep.value > steps.value.length) {
    return null;
  }
  return steps.value[currentStep.value - 1];
});

function generateArray(size: number) {
  stop();
  const arr: number[] = [];
  for (let i = 0; i < size; i++) {
    arr.push(Math.floor(Math.random() * 90) + 10);
  }
  array.value = [...arr];
  steps.value = mergeSort([...arr]);
  currentStep.value = 0;
  comparisons.value = 0;
  swaps.value = 0;
  localPlaying.value = false;
}

function play() {
  if (steps.value.length === 0) return;
  localPlaying.value = true;
  step();
}

async function step() {
  if (!localPlaying.value || currentStep.value >= steps.value.length) {
    localPlaying.value = false;
    return;
  }
  const s = steps.value[currentStep.value];
  const delay = await applyStep(s);
  // currentStep 在 store.onStepComplete() 中递增，保持与动画同步
  timer = setTimeout(step, delay ?? props.speed);
}

async function applyStep(step: SortStep) {
  currentStep.value++;
  const animationDelay = await canvasRef.value?.applyStep(step);
  if (step.type === "compare") {
    comparisons.value++;
  } else if (step.type === "swap" || step.type === "merge" || step.type === "set") {
    swaps.value++;
  }
  if (currentStep.value >= steps.value.length) {
    localPlaying.value = false;
  }
  if (step.arraySnapshot) {
    array.value = [...step.arraySnapshot];
  }
  return animationDelay;
}

function stop() {
  localPlaying.value = false;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

function reset() {
  stop();
  currentStep.value = 0;
  comparisons.value = 0;
  swaps.value = 0;
  if (array.value.length > 0) {
    array.value = [...array.value];
  }
  canvasRef.value?.updateBars();
}

watch(
  () => props.isPlaying,
  (playing) => {
    if (playing) play();
    else stop();
  },
);

watch(
  () => props.speed,
  () => {
    if (localPlaying.value && currentStep.value < steps.value.length) {
      stop();
      play();
    }
  },
);

watch(
  () => store.arraySize,
  (size) => {
    generateArray(size);
  },
);

onMounted(() => {
  generateArray(store.arraySize);
});

async function stepOnce() {
  if (!localPlaying.value && currentStep.value < steps.value.length) {
    const s = steps.value[currentStep.value];
    await applyStep(s);
  }
}

defineExpose({ generateArray, reset, step: stepOnce });
</script>

<template>
  <div class="algorithm-view">
    <SortBarCanvas
      ref="canvasRef"
      :array="array"
      :highlighted-indices="highlightedIndices"
      :animation-speed="speed"
    />
    <footer class="stats-bar">
      <div class="stat">
        <span class="stat-label">比较次数</span>
        <span class="stat-value">{{ comparisons }}</span>
      </div>
      <div class="stat">
        <span class="stat-label">交换次数</span>
        <span class="stat-value">{{ swaps }}</span>
      </div>
      <div class="stat">
        <span class="stat-label">当前步骤</span>
        <span class="stat-value">{{ currentStep }} / {{ steps.length }}</span>
      </div>
      <div class="stat description" v-if="currentStepInfo">
        <span class="stat-label">操作</span>
        <span class="stat-value desc">{{ currentStepInfo.description }}</span>
      </div>
    </footer>
  </div>
</template>

<style scoped>
@import "@/styles/shared.css";
</style>
