<script setup lang="ts">
/**
 * The floating nav pill, shared in spec with barrelman-landing's SiteNav so
 * the two sites wear the same header.
 *
 * The pill itself is `.nav-pill` from @parchment/design, so its width, tint,
 * rule and shadow cannot drift from barrelman's again. What is left here is
 * the arrangement inside it, which is also matched: a 1.75rem gutter between
 * links, set in the mid ink so the bar reads as one weight with the active
 * item picked out on hover.
 */
</script>

<template>
  <nav class="nav-pill" aria-label="Primary">
    <div class="flex items-center justify-between gap-6">
      <slot name="brand" />
      <ul class="hidden items-center gap-7 text-ink-soft md:flex">
        <slot />
      </ul>
      <slot name="cta" />
    </div>
  </nav>
</template>
