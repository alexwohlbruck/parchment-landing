<script setup lang="ts">
import { computed } from "vue";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        primary: "bg-brand text-parchment hover:bg-brand/85",
        dark: "bg-base-dark text-parchment hover:bg-base-dark/85",
        outline:
          "border border-base-dark bg-transparent text-base-dark hover:bg-base-dark/5",
        ghost: "text-base-dark hover:bg-base-dark/15",
      },
      size: {
        sm: "h-8 px-3",
        md: "h-10 px-4",
        lg: "h-12 px-6",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

type ButtonVariants = VariantProps<typeof buttonVariants>;

const props = withDefaults(
  defineProps<{
    href?: string;
    disabled?: boolean;
    variant?: ButtonVariants["variant"];
    size?: ButtonVariants["size"];
    class?: string;
  }>(),
  {
    variant: "primary",
    size: "md",
  }
);

const classes = computed(() =>
  cn(buttonVariants({ variant: props.variant, size: props.size }), props.class)
);
</script>

<template>
  <component
    :is="href ? 'a' : 'button'"
    :href="href"
    :disabled="disabled"
    :class="classes"
  >
    <slot />
  </component>
</template>
