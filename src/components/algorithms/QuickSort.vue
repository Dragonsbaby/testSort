<script setup lang="ts">
import { ref, watch, onMounted, computed } from "vue";
import { quickSort } from "@/utils/sortingAlgorithms";
import type { SortStep } from "@/types/sorting";
import SortBarCanvas from "@/components/SortBarCanvas.vue";
import { useSortStore } from "@/stores/sortStore";

const props = defineProps<{
  isPlaying: boolean;
  speed: number;
}>();

const store = useSortStore();

const emit = defineEmits<{
  (e: "array-generated", arr: number[]): void;
  (e: "step-change", step: SortStep | null): void;
  (e: "comparisons", n: number): void;
  (e: "swaps", n: number): void;
}>();

const array = ref<number[]>([]);
const steps = ref<SortStep[]>([]);
const currentStep = ref(0);
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

function generateArray(size: number) {
  stop();
  const arr: number[] = [];
  for (let i = 0; i < size; i++) {
    arr.push(Math.floor(Math.random() * 90) + 10);
  }
  array.value = [...arr];
  steps.value = quickSort([...arr]);
  currentStep.value = 0;
  localPlaying.value = false;
  emit("array-generated", array.value);
  emit("step-change", null);
  emit("comparisons", 0);
  emit("swaps", 0);
}

function play() {
  if (steps.value.length === 0) return;
  localPlaying.value = true;
  step();
}

function step() {
  if (!localPlaying.value || currentStep.value >= steps.value.length) {
    localPlaying.value = false;
    return;
  }
  const s = steps.value[currentStep.value];
  applyStep(s);
  if (s.type === "compare") emit("comparisons", emitComparisons++);
  else if (s.type === "swap" || s.type === "merge" || s.type === "set")
    emit("swaps", emitSwaps++);
  currentStep.value++;
  timer = setTimeout(step, props.speed);
}

let emitComparisons = 0;
let emitSwaps = 0;

function applyStep(step: SortStep) {
  canvasRef.value?.applyStep(step);
  if (step.arraySnapshot) {
    array.value = [...step.arraySnapshot];
  }
  emit("step-change", step);
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
  emitComparisons = 0;
  emitSwaps = 0;
  if (array.value.length > 0) {
    array.value = [...array.value];
  }
  canvasRef.value?.updateBars();
  emit("comparisons", 0);
  emit("swaps", 0);
  emit("step-change", null);
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

function stepOnce() {
  if (!localPlaying.value && currentStep.value < steps.value.length) {
    const s = steps.value[currentStep.value];
    applyStep(s);
    if (s.type === "compare") emitComparisons++;
    else if (s.type === "swap" || s.type === "merge" || s.type === "set")
      emitSwaps++;
    currentStep.value++;
    emit("comparisons", emitComparisons);
    emit("swaps", emitSwaps);
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
  </div>
</template>

<style scoped>
.algorithm-view {
  flex: 1;
  display: flex;
  flex-direction: column;
}
</style>
