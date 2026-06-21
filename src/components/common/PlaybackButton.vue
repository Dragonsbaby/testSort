<script setup lang="ts">
/**
 * 通用播放控制按钮（step-back / play / pause / step-forward / reset）。
 * 统一各算法视图的播放按钮 SVG 与样式，单一来源。
 * 样式复用 algorithms/_algorithm-common.scss 的 .pb-btn / .pb-icon。
 */
type PlaybackIcon = "step-back" | "play" | "pause" | "step-forward" | "reset";

withDefaults(defineProps<{
  icon: PlaybackIcon;
  title: string;
  disabled?: boolean;
  active?: boolean;
}>(), {
  disabled: false,
  active: false,
});

defineEmits<{ click: [] }>();
</script>

<template>
  <button
    class="pb-btn"
    :class="{ active }"
    :disabled="disabled"
    :title="title"
    @click="$emit('click')"
  >
    <!-- reset 为描边图标（fill=none, stroke），其余为填充图标（fill=currentColor） -->
    <svg
      class="pb-icon"
      viewBox="0 0 24 24"
      :fill="icon === 'reset' ? 'none' : 'currentColor'"
      :stroke="icon === 'reset' ? 'currentColor' : undefined"
      :stroke-width="icon === 'reset' ? 2 : undefined"
    >
      <template v-if="icon === 'step-back'">
        <polygon points="19,4 9,12 19,20" /><rect x="5" y="4" width="3" height="16" />
      </template>
      <template v-else-if="icon === 'play'">
        <polygon points="5,3 19,12 5,21" />
      </template>
      <template v-else-if="icon === 'pause'">
        <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
      </template>
      <template v-else-if="icon === 'step-forward'">
        <polygon points="5,4 15,12 5,20" /><rect x="16" y="4" width="3" height="16" />
      </template>
      <template v-else-if="icon === 'reset'">
        <path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8" /><path d="M3 3v5h5" />
      </template>
    </svg>
  </button>
</template>

<style lang="scss" scoped>
@use '../algorithms/algorithm-common';
</style>
