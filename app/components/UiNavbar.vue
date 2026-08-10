<script setup lang="ts">
/**
 * The floating nav pill.
 *
 * This and barrelman-landing's <SiteNav> are the same component, and every
 * class string they share is byte-identical. They differ in the mark, the
 * labels, the hrefs — and, deliberately, in where the CTA goes on a phone:
 * "Get a key" is barrelman's ask, so its pill stays in the bar at every width,
 * where Parchment's ask is the waitlist form further down the page.
 *
 * Two faults this fixed when it was written, both found by measuring:
 *
 * - Height. The pill's padding is shared, but the row inside is as tall as the
 *   tallest thing in it, and that is the CTA. Barrelman's filled pill is 34px
 *   and this site's ghost button was 32px, so the two headers were never the
 *   same object.
 * - Centring. Both were `justify-between` with the links as the middle child,
 *   which does not centre them — it centres the *gap left over* after the
 *   brand and the actions, and those are different widths on every page. The
 *   links are absolutely positioned at 50% now.
 *
 * The links and the CTA are props rather than slots because the mobile sheet
 * renders both a second time, and a slot can only be used once.
 */
import { Menu, X } from "lucide-vue-next";
import Button from "@/components/ui/button/Button.vue";

interface NavLink {
  href: string;
  label: string;
  external?: boolean;
}

defineProps<{ links: NavLink[]; cta: NavLink }>();

const open = ref(false);

/** How long the sheet takes to collapse. Must match `duration-200` below. */
const CLOSE_MS = 200;

/**
 * Whether the pill wears its panel shape — which is not the same question as
 * whether the menu is open.
 *
 * `.nav-pill` is `rounded-full`, and on a box 169px tall that resolves to a
 * stadium: the corners clamp to half the height. `.nav-pill-open` squares it
 * off to 24px, and dropping that class the instant somebody taps close put
 * the stadium back *while the panel was still collapsing through it* — the
 * same bulge the radius transition used to cause, arriving from the opposite
 * direction.
 *
 * Opening, the two agree already: the square radius applies immediately and
 * the box grows from nothing, so there is no tall box wearing a round corner
 * at any point. Only the closing direction needs the shape held back, until
 * the height it was chosen for has gone.
 */
const expanded = ref(false);
let collapseTimer: ReturnType<typeof setTimeout> | undefined;

watch(open, (isOpen) => {
  clearTimeout(collapseTimer);
  if (isOpen) {
    expanded.value = true;
    return;
  }
  collapseTimer = setTimeout(() => (expanded.value = false), CLOSE_MS);
});

onBeforeUnmount(() => clearTimeout(collapseTimer));

/**
 * How the sheet opens is entirely in the template below — `grid-template-rows`
 * from `0fr` to `1fr`, which is the one way to animate to a height nobody has
 * measured. `height: auto` is not interpolable, and the usual workaround of
 * animating to a large `max-height` makes the duration a lie: the panel
 * reaches its real height early and then spends the rest of the time
 * animating empty space, so a three-item menu and a six-item menu open at
 * visibly different speeds. An `fr` track resolves against the content's own
 * height every frame, so the timing is the timing whatever is in the menu.
 */
</script>

<template>
  <nav
    class="nav-pill"
    :class="{ 'nav-pill-open': expanded }"
    aria-label="Primary"
  >
    <!--
      `gap-3` below sm. The brand and the actions are both `shrink-0` — a
      wordmark that truncates and a CTA that wraps are both worse than a tight
      bar — so nothing in this row can give, and a 24px minimum gap it cannot
      afford is the difference between fitting and overflowing.
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
        <!--
          The bar carries the CTA only where it also carries the links. Below
          `md` both live in the sheet instead, so the bar is a lockup and a
          way to open the menu and nothing else — a filled pill wedged between
          those two was the loudest object on a phone screen, for a
          destination that is not what this page is asking of a visitor.
        -->
        <Button
          :href="cta.href"
          variant="dark"
          size="pill"
          class="max-md:hidden"
        >
          {{ cta.label }}
        </Button>
        <!--
          Both icons are always mounted and cross-faded through a quarter
          turn, rather than swapped with `v-if`. A swap is instant by
          definition — there is no pair of states for CSS to interpolate
          between if one of them was never in the DOM.
        -->
        <button
          class="relative rounded-full p-1.5 text-ink-soft transition-colors hover:bg-base-dark/5 hover:text-base-dark md:hidden"
          :aria-expanded="open"
          aria-label="Toggle navigation"
          @click="open = !open"
        >
          <span class="relative block size-5">
            <Menu
              class="absolute inset-0 size-5 transition-all duration-200 ease-out motion-reduce:transition-none"
              :class="open ? 'rotate-90 scale-50 opacity-0' : 'rotate-0 scale-100 opacity-100'"
              stroke-width="1.5"
            />
            <X
              class="absolute inset-0 size-5 transition-all duration-200 ease-out motion-reduce:transition-none"
              :class="open ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-50 opacity-0'"
              stroke-width="1.5"
            />
          </span>
        </button>
      </div>
    </div>

    <!--
      The sheet.

      Kept mounted rather than `v-if`, because a panel that is not in the DOM
      has no closed state to animate *from* — the same reason both icons above
      are mounted. `inert` takes it out of the tab order and off the
      accessibility tree while it is shut, which `v-if` used to do for free.

      Opening at 300ms on a strong decelerate, so almost all of the distance is
      covered early and the panel reads as arriving rather than travelling.
      Closing at 200ms and accelerating: a reader who has decided to dismiss
      something is done with it and should not have to watch it leave.
    -->
    <div
      class="grid transition-[grid-template-rows] motion-reduce:transition-none md:hidden"
      :class="
        open
          ? 'grid-rows-[1fr] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]'
          : 'grid-rows-[0fr] duration-200 ease-[cubic-bezier(0.4,0,1,1)]'
      "
      :inert="!open"
    >
      <div class="min-h-0 overflow-hidden">
        <ul class="mt-1 flex flex-col border-t border-rule pt-1">
          <!--
            Staggered, so the rows arrive as a list being dealt rather than as
            one block sliding. The delay only applies on the way in: on the way
            out they leave together, because a stagger in reverse reads as the
            panel struggling to close.
          -->
          <li
            v-for="(link, i) in links"
            :key="link.label"
            class="transition-all duration-300 ease-out motion-reduce:transition-none"
            :class="open ? 'translate-y-0 opacity-100' : '-translate-y-1.5 opacity-0'"
            :style="{ transitionDelay: open ? `${70 + i * 45}ms` : '0ms' }"
          >
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

        <!-- The action the sheet exists to make reachable, at the foot of it
             and full width, which is where a thumb already is. Last in the
             stagger: it is the thing to land on. -->
        <div
          class="transition-all duration-300 ease-out motion-reduce:transition-none"
          :class="open ? 'translate-y-0 opacity-100' : '-translate-y-1.5 opacity-0'"
          :style="{ transitionDelay: open ? `${70 + links.length * 45}ms` : '0ms' }"
        >
          <Button
            :href="cta.href"
            variant="dark"
            size="md"
            class="mb-1 mt-2 w-full"
            @click="open = false"
          >
            {{ cta.label }}
          </Button>
        </div>
      </div>
    </div>
  </nav>
</template>
