<script setup lang="ts">
import { computed } from "vue";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Variants carry the app's lighting model, not just a colour swap.
 *
 * Three states, and the physical story is the point: a control rests slightly
 * proud of the page (top highlight + small shadow), lifts under the cursor
 * (brighter highlight, longer shadow), and is pushed *into* the page when
 * pressed — outer shadow removed, an inner shadow cast down from the top edge,
 * and the whole thing nudged a pixel down.
 *
 * Filled variants take the 0.1/0.2 highlight because white at 0.7 over a dark
 * fill reads as a scratch; light ones take 0.7 or it disappears into paper.
 * These match parchment/web/src/components/ui/button/index.ts.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        primary:
          "border border-white/15 bg-brand text-parchment depth-raised hover:bg-brand/90 hover:shadow-[0_2px_6px_rgba(0,0,0,0.15)] hover:inset-shadow-[0_1px_0_rgba(255,255,255,0.2)] active:bg-brand/80 active:shadow-none active:inset-shadow-[0_2px_4px_rgba(0,0,0,0.2)] active:translate-y-px",
        dark: "border border-white/15 bg-base-dark text-parchment depth-raised hover:bg-base-dark/90 hover:shadow-[0_2px_6px_rgba(0,0,0,0.15)] hover:inset-shadow-[0_1px_0_rgba(255,255,255,0.2)] active:bg-base-dark/80 active:shadow-none active:inset-shadow-[0_2px_4px_rgba(0,0,0,0.2)] active:translate-y-px",
        outline:
          "border border-base-dark/40 bg-parchment text-base-dark depth hover:bg-base-dark/5 hover:shadow-[0_2px_6px_rgba(0,0,0,0.1)] active:bg-base-dark/10 active:shadow-none active:inset-shadow-[0_2px_4px_rgba(0,0,0,0.06)] active:translate-y-px",
        ghost:
          "text-base-dark hover:bg-base-dark/15 active:bg-base-dark/20 active:translate-y-px",
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
    variant?: ButtonVariants["variant"];
    size?: ButtonVariants["size"];
    class?: string;
    disabled?: boolean;
  }>(),
  {
    variant: "primary",
    size: "md",
    disabled: false,
  }
);

const classes = computed(() =>
  cn(
    buttonVariants({ variant: props.variant, size: props.size }),
    props.class,
    {
      "bg-base-dark/80 pointer-events-none": props.disabled,
    }
  )
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
