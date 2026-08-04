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
  <nav class="nav-pill" aria-label="Primary">
    <div class="flex items-center justify-between gap-6">
      <slot name="brand" />
      <ul class="hidden gap-6 md:flex">
        <slot />
      </ul>
      <slot name="cta" />
    </div>
  </nav>
</template>
