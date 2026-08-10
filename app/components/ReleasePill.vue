<script setup lang="ts">
/**
 * The announcement pill above the headline — what shipped most recently, as a
 * version chip and a sentence, linking to the release notes.
 *
 * Same object as barrelman-landing's, and deliberately so: a rounded outline
 * on paper, a tinted chip, the title in the mid ink, an arrow that steps right
 * on hover. Two differences, both because the two sites are different
 * documents rather than because anything drifted — the chip carries the
 * version rather than the word "New", since Parchment ships versioned builds
 * and an API does not; and it is tinted with the brand blue rather than the
 * chartmaker's red, which is barrelman's own colour.
 *
 * The version is the point of the chip. Barrelman's says "New" and goes stale
 * the moment it is not, because nothing drives it; this one cannot, because
 * what it says is fetched.
 */
import { ArrowRight } from "lucide-vue-next";
import { RELEASES_URL } from "@/lib/links";
import type { LatestRelease } from "~~/server/api/release.get";

/**
 * Handed the release rather than fetching it.
 *
 * The whole hero lives inside <ClientOnly>, because v-motion animates from JS,
 * and a `useFetch` in here would therefore only ever run in the browser — one
 * request per visitor for a value the server already had. Fetched in the page,
 * which does render on the server, it arrives in the payload and the browser
 * asks for nothing.
 */
defineProps<{ release: LatestRelease | null }>();

</script>

<template>
  <!--
    Nothing at all when there is no release to name. An empty pill, or one
    reading "Latest release", is worse than the gap it leaves — it occupies the
    space above the headline to say nothing.
  -->
  <a
    v-if="release"
    :href="release.url || RELEASES_URL"
    target="_blank"
    rel="noopener"
    class="depth group inline-flex max-w-full items-center gap-2.5 rounded-full border border-rule-strong bg-parchment/75 py-1 pl-1 pr-3 backdrop-blur-sm transition-all duration-150 hover:border-ink-soft hover:bg-paper-aged"
  >
    <span
      class="rounded-full bg-brand/10 px-2 py-1 text-caption font-medium text-brand"
    >
      {{ release.version }}
    </span>
    <span
      class="truncate text-caption text-ink-soft transition-colors group-hover:text-base-dark"
    >
      {{ release.title }}
    </span>
    <ArrowRight
      class="size-3.5 shrink-0 text-base-light transition-all group-hover:translate-x-0.5 group-hover:text-ink-soft"
      stroke-width="1.5"
    />
  </a>
</template>
