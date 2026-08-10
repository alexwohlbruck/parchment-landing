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
 * The shadow stacks that say all of that now come from @parchment/design's
 * `.btn-base` / `.btn-filled` / `.btn-outlined`, so a variant here declares
 * only its colours. They were previously written out per variant as arbitrary
 * `shadow-[...]` values — four copies of the same three numbers, in one of the
 * two places the two sites had to agree and could not be made to.
 *
 * The size prop stays local. Barrelman sets one button size through the class
 * itself; this site has a form row where the control has to match a 40px
 * field, so height and padding are set here and the class's own `px-5 py-2.5`
 * is overridden by it.
 */
const buttonVariants = cva(
  "btn-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "btn-filled bg-brand text-parchment hover:bg-brand/90 active:bg-brand/80",
        dark: "btn-filled bg-base-dark text-parchment hover:bg-base-dark/90 active:bg-base-dark/80",
        outline: "btn-outlined text-base-dark",
        // No surface of its own, so it has no lighting to inherit — a ghost
        // button is a hit area, and all it owes the model is the press.
        ghost:
          "text-base-dark hover:bg-base-dark/15 active:bg-base-dark/20 active:translate-y-px",
      },
      size: {
        sm: "h-8 px-3",
        md: "h-10 px-4",
        lg: "h-12 px-6",
        /**
         * The nav's CTA, set by padding rather than by height so it comes out
         * at exactly the 34px barrelman's does — 20px of line box, 6px either
         * side, 1px of border. Given as a height it would be 34px of box with
         * different type metrics inside it, which is a different object that
         * happens to measure the same.
         */
        pill: "rounded-full px-4 py-1.5",
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
