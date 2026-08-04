<script setup lang="ts">
/**
 * The floating nav pill, shared in spec with barrelman-landing's SiteNav so
 * the two sites wear the same header.
 *
 * Two changes from the original: `depth-floating` replaces the hand-rolled
 * `shadow-[0_1px_2px_...]`, so the pill is lit by the same model as every
 * other raised surface in the house; and the width is capped at the content
 * measure. `lg:w-[60%]` was fine over a full-bleed hero with nothing to relate
 * to, but it drifts wider than the page content past about 1700px.
 */
</script>

<template>
  <nav
    class="depth-floating fixed left-1/2 top-4 z-20 w-[95%] max-w-5xl -translate-x-1/2 rounded-full border border-white/60 bg-white/40 px-4 py-2 text-sm text-base-dark backdrop-blur-xl md:w-[88%] lg:w-[80%]"
    aria-label="Primary"
  >
    <div class="flex items-center justify-between gap-6">
      <slot name="brand" />
      <ul class="hidden gap-6 md:flex">
        <slot />
      </ul>
      <slot name="cta" />
    </div>
  </nav>
</template>
