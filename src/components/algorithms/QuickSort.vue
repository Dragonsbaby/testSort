<script setup lang="ts">
import { watch } from "vue";
import { quickSort } from "@/utils/sortingAlgorithms";
import type { SortStep } from "@/types/sorting";

const props = defineProps<{
  array: number[];
}>();

const emit = defineEmits<{
  (e: "steps-generated", steps: SortStep[]): void;
}>();

watch(
  () => props.array,
  (newArray) => {
    const steps = quickSort([...newArray]);
    emit("steps-generated", steps);
  },
  { immediate: true },
);
</script>
