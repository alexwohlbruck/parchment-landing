<script setup lang="ts">
import { computed } from "vue";

type Variant = "primary" | "outline" | "ghost";
interface Props {
  href?: string;
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  variant: "primary",
  size: "md",
  disabled: false,
});

const base =
  "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-base-dark/40 disabled:opacity-50 disabled:pointer-events-none";

const sizeCls = computed(() => {
  switch (props.size) {
    case "sm":
      return "px-3 py-1.5 text-[0.9rem]";
    case "lg":
      return "px-6 py-3 text-[1rem]";
    default:
      return "px-4 py-2 text-[0.92rem]";
  }
});

const variantCls = computed(() => {
  switch (props.variant) {
    case "outline":
      return "border border-base-dark/25 bg-parchment text-base-dark shadow-[0_2px_6px_rgba(63,47,30,0.12)] hover:bg-base-dark/5";
    case "ghost":
      return "bg-transparent text-base-dark hover:bg-base-dark/5";
    default:
      return "bg-base-dark text-parchment shadow-[0_2px_6px_rgba(63,47,30,0.14)] hover:bg-base-dark/90";
  }
});

const cls = computed(() => `${base} ${sizeCls.value} ${variantCls.value}`);
</script>

<template>
  <component
    :is="href ? 'a' : 'button'"
    :href="href"
    :disabled="disabled"
    :class="cls"
  >
    <slot />
  </component>
</template>
