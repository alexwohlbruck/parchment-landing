<script setup lang="ts">
/**
 * The floating nav pill.
 *
 * This and barrelman-landing's <SiteNav> are the same component written twice,
 * and every class string in the template below is byte-identical to the one
 * over there. They differ in three things only: the mark, the labels, and the
 * hrefs. If you change a size or a colour here, change it there.
 *
 * They had drifted in two ways that measurement caught and the eye did not:
 *
 * - Height. The pill is `.nav-pill` from @parchment/design, so its padding is
 *   shared, but the row inside it is as tall as the tallest thing in it — and
 *   that is the CTA. Barrelman's is a filled pill at `py-1.5`, 34px; this one
 *   was a ghost button at `h-8`, 32px. Two pixels, which nobody would see on
 *   one page and which meant the two headers were never the same object.
 * - Centring. Both were `justify-between` with the links as the middle child,
 *   which does not centre them — it centres the *gap left over* after the
 *   brand and the actions, and those are different widths on every page. The
 *   links are absolutely positioned at 50% now, so they sit on the bar's axis
 *   whatever is either side of them.
 *
 * The links are a prop rather than a slot because the mobile sheet has to
 * render the same list a second time, and a slot can only be used once.
 */
import { Menu, X } from "lucide-vue-next";

interface NavLink {
  href: string;
  label: string;
  external?: boolean;
}

defineProps<{ links: NavLink[] }>();

const open = ref(false);
</script>

<template>
  <nav class="nav-pill" :class="{ 'nav-pill-open': open }" aria-label="Primary">
    <!--
      `gap-3` below sm. The brand and the actions are both `shrink-0` — a
      wordmark that truncates and a CTA that wraps are both worse than a tight
      bar — so nothing in this row can give, and a 24px minimum gap it cannot
      afford is the difference between fitting and overflowing. Measured at
      360px the row needs 302 of the 310 it has; at `gap-6` it needed 314 and
      pushed the menu button out past the pill.
    -->
    <div class="relative flex items-center justify-between gap-3 sm:gap-6">
      <slot name="brand" />

      <!--
        Absolutely centred, so the group sits on the pill's axis rather than
        wherever the brand and the actions happen to leave room. `md:flex`
        keeps it off the phone, where there is no axis to sit on.
      -->
      <ul
        class="absolute left-1/2 hidden -translate-x-1/2 items-center gap-7 text-ink-soft md:flex"
      >
        <li v-for="link in links" :key="link.label">
          <a
            :href="link.href"
            :target="link.external ? '_blank' : undefined"
            :rel="link.external ? 'noopener' : undefined"
            class="transition-colors hover:text-base-dark"
          >
            {{ link.label }}
          </a>
        </li>
      </ul>

      <div class="flex shrink-0 items-center gap-1">
        <slot name="cta" />
        <button
          class="ml-1 rounded-full p-1.5 text-ink-soft transition-colors hover:bg-base-dark/5 hover:text-base-dark md:hidden"
          :aria-expanded="open"
          aria-label="Toggle navigation"
          @click="open = !open"
        >
          <X v-if="open" class="size-5" stroke-width="1.5" />
          <Menu v-else class="size-5" stroke-width="1.5" />
        </button>
      </div>
    </div>

    <ul
      v-if="open"
      class="mt-1 flex flex-col border-t border-rule pt-1 md:hidden"
    >
      <li v-for="link in links" :key="link.label">
        <a
          :href="link.href"
          :target="link.external ? '_blank' : undefined"
          :rel="link.external ? 'noopener' : undefined"
          class="block rounded-lg px-2 py-2 text-ink-soft transition-colors hover:bg-base-dark/5 hover:text-base-dark"
          @click="open = false"
        >
          {{ link.label }}
        </a>
      </li>
    </ul>
  </nav>
</template>
