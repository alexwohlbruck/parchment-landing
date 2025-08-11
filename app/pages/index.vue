<script setup lang="ts">
const { data: auth } = await useFetch("/api/auth-status");
import { onMounted, ref, onBeforeUnmount } from "vue";
import UiNavbar from "@/components/UiNavbar.vue";
import Button from "@/components/ui/button/Button.vue";
import { useGlobeMover } from "@/composables/useGlobeMover";
import HeroGlobe from "@/components/HeroGlobe.client.vue";

const motionNav = {
  initial: { opacity: 0, y: -16 },
  enter: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
} as const;

const motionH1 = {
  initial: { opacity: 0, y: 24 },
  enter: { opacity: 1, y: 0, transition: { duration: 0.7, delay: 0.1 } },
} as const;

const motionP = {
  initial: { opacity: 0, y: 24 },
  enter: { opacity: 1, y: 0, transition: { duration: 0.7, delay: 0.25 } },
} as const;

const motionCtas = {
  initial: { opacity: 0, y: 24 },
  enter: { opacity: 1, y: 0, transition: { duration: 0.7, delay: 0.4 } },
} as const;

// Only enable motion on client to avoid SSR directive hooks
const isClient = ref(false);
onMounted(() => {
  isClient.value = true;
});
const {
  globeRef,
  activeTarget,
  positionGlobe,
  positionGlobeToRect,
  attach,
  detach,
} = useGlobeMover();

const heroTargetRef = ref<HTMLDivElement | null>(null);
const tryTargetRef = ref<HTMLDivElement | null>(null);
let heroRect: {
  left: number;
  top: number;
  width: number;
  height: number;
} | null = null;
let tryRect: {
  left: number;
  top: number;
  width: number;
  height: number;
} | null = null;

// Select the ghost container nearest to viewport center
function selectNearestTarget(): HTMLElement | null {
  const candidates: HTMLElement[] = [];
  if (heroTargetRef.value) candidates.push(heroTargetRef.value);
  if (tryTargetRef.value) candidates.push(tryTargetRef.value);
  if (!candidates.length) return null;

  const vh = innerHeight;
  const centerY = vh / 2;
  let best: { el: HTMLElement; dist: number } | null = null;
  for (const el of candidates) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const cy = r.top + r.height / 2;
    const dist = Math.abs(cy - centerY);
    if (!best || dist < best.dist) best = { el, dist };
  }
  return best?.el || null;
}

function computeRect(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

let root: HTMLElement | null = null;
let scrollHandler: (() => void) | null = null;
let resizeHandler: (() => void) | null = null;
let switchScheduled = false;
let lastSwitchAt = 0;
const SWITCH_COOLDOWN_MS = 120; // hysteresis to avoid rapid flipping near boundaries

// Intro sit-up animation (3s) ending at normal state; enable scroll tilt on animation end
onMounted(() => {
  root = document.querySelector("main") as HTMLElement | null;
  if (root) attach(root);
  // Intro animations handled via v-motion in template

  // Initial placement: choose nearest target and place instantly
  requestAnimationFrame(() => {
    const next = selectNearestTarget();
    if (next) {
      activeTarget.value = next;
      positionGlobe(next, false);
      // cache rects for precise return positions
      if (heroTargetRef.value) {
        const r = heroTargetRef.value.getBoundingClientRect();
        heroRect = {
          left: r.left,
          top: r.top,
          width: r.width,
          height: r.height,
        };
      }
      if (tryTargetRef.value) {
        const r2 = tryTargetRef.value.getBoundingClientRect();
        tryRect = {
          left: r2.left,
          top: r2.top,
          width: r2.width,
          height: r2.height,
        };
      }
    }
  });

  // Manual scroll-driven target switching with animation
  const updateActiveTarget = () => {
    if (switchScheduled) return;
    switchScheduled = true;
    requestAnimationFrame(() => {
      switchScheduled = false;
      const now = performance.now();
      const current = activeTarget.value;
      const next = selectNearestTarget();
      if (!next) return;
      if (next !== current && now - lastSwitchAt > SWITCH_COOLDOWN_MS) {
        lastSwitchAt = now;
        activeTarget.value = next;
        // Use cached rects if available to ensure consistent return positions
        if (next === heroTargetRef.value && heroRect) {
          positionGlobeToRect(heroRect, true);
        } else if (next === tryTargetRef.value && tryRect) {
          positionGlobeToRect(tryRect, true);
        } else {
          const rect = computeRect(next);
          positionGlobeToRect(rect, true);
        }
      }
    });
  };

  scrollHandler = () => updateActiveTarget();
  resizeHandler = () => {
    // Re-cache rects on resize for stability
    if (heroTargetRef.value) {
      const r = heroTargetRef.value.getBoundingClientRect();
      heroRect = { left: r.left, top: r.top, width: r.width, height: r.height };
    }
    if (tryTargetRef.value) {
      const r2 = tryTargetRef.value.getBoundingClientRect();
      tryRect = {
        left: r2.left,
        top: r2.top,
        width: r2.width,
        height: r2.height,
      };
    }
    updateActiveTarget();
  };

  if (root) root.addEventListener("scroll", scrollHandler, { passive: true });
  window.addEventListener("resize", resizeHandler);
});

onBeforeUnmount(() => {
  if (root && scrollHandler) root.removeEventListener("scroll", scrollHandler);
  if (resizeHandler) window.removeEventListener("resize", resizeHandler);
  detach();
});
</script>

<template>
  <main class="snap-y snap-mandatory overflow-y-auto h-[100dvh]">
    <section
      id="hero"
      class="relative min-h-[100dvh] overflow-hidden bg-[#E3D9CF] snap-start"
    >
      <div class="absolute inset-0 z-0">
        <img
          src="/map.png"
          alt="parchment"
          class="h-[100dvh] w-[100dvw] object-cover object-center opacity-100"
          style="
            mask-image: linear-gradient(
              to bottom,
              rgba(0, 0, 0, 0.1),
              rgba(0, 0, 0, 0.5),
              rgba(0, 0, 0, 0.8)
            );
          "
        />
      </div>

      <div v-if="isClient" v-motion="motionNav">
        <UiNavbar>
          <template #brand>
            <div class="flex items-center gap-3 text-base-dark">
              <svg
                class="size-7"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 1024 1024"
                fill="currentColor"
                aria-hidden="true"
                preserveAspectRatio="xMidYMid meet"
              >
                <path
                  d="M199.9,547.8c7.4,28.2,29.7,138.1-32.2,265.4-1.4,2.9.8,6.3,4.1,6.1,46.9-2.7,313.2-10.5,631.7,123.9,2.2.9,4.7,0,5.6-2.2,9.1-21.4,49.8-128.4,4.3-243.6-.5-1.3-1.6-2.2-2.9-2.6l-605.4-152.2c-3.1-.8-6,2.1-5.2,5.2Z"
                />
                <path
                  d="M269.2,297.2c11.5,25.9,39.5,110.1-24.3,209.3-1.8,2.7,0,6.3,3.3,6.6,47.6,3.4,319.8,27.1,562.9,137.3,2.4,1.1,5.2-.2,5.9-2.8,6.2-23.8,29.6-130.5-21.9-217.6-.6-1-1.5-1.7-2.6-2l-518.2-136.6c-3.5-.9-6.4,2.6-5,5.8Z"
                />
                <path
                  d="M351.1,86.8c9.1,23.1,28.6,93.2-30.5,170.9-2,2.7-.3,6.5,3,6.8,45,3.7,273.3,27,462,127.3,2.3,1.2,5.1.1,6-2.3,7.7-21.1,35.8-111.6-11.2-193.9-.6-1-1.5-1.7-2.6-2l-421.6-112.5c-3.4-.9-6.4,2.4-5.1,5.7Z"
                />
              </svg>
              <span class="font-medium">Parchment</span>
            </div>
          </template>
          <li>
            <a
              href="#"
              class="cursor-pointer text-base-dark/70 hover:text-base-dark rounded"
            >
              Home
            </a>
          </li>
          <li>
            <a
              href="#"
              class="cursor-pointer text-base-dark/70 hover:text-base-dark rounded"
            >
              Maps
            </a>
          </li>
          <li>
            <a
              href="#"
              class="cursor-pointer text-base-dark/70 hover:text-base-dark rounded"
            >
              Download
            </a>
          </li>
          <li>
            <a
              href="#"
              class="cursor-pointer text-base-dark/70 hover:text-base-dark rounded"
            >
              Developers
            </a>
          </li>
          <li>
            <a
              href="#"
              class="cursor-pointer text-base-dark/70 hover:text-base-dark rounded"
            >
              Demo
            </a>
          </li>
          <template #cta>
            <Button href="#" variant="ghost" size="sm">Launch app →</Button>
          </template>
        </UiNavbar>
      </div>

      <div
        class="relative z-10 mx-auto flex w-[min(1100px,92%)] max-w-5xl h-[65dvh] flex-col items-center justify-center will-change-transform [transform-style:preserve-3d] [perspective:1000px]"
      >
        <div v-if="isClient" v-motion="motionH1">
          <h1
            class="text-center font-serif text-[clamp(2rem,6vw,4.6rem)] leading-[0.9] text-base-dark"
            style="font-variation-settings: 'wght' 700"
          >
            The
            <span
              class="relative text-brand [text-shadow:2px_2px_0_rgba(63,47,30,0.16)]"
              >next generation</span
            >
            of<br />
            digital mapping
          </h1>
        </div>
        <div v-if="isClient" v-motion="motionP">
          <p class="mt-4 max-w-2xl text-center text-[1.1rem] text-base-dark/80">
            Explore the world with beautiful, detailed maps crafted by the
            community.
          </p>
        </div>
        <div v-if="isClient" v-motion="motionCtas">
          <div class="mt-6 flex gap-3">
            <Button variant="outline" size="md" class="shadow">Download</Button>
            <Button href="#" variant="dark" size="md" class="shadow">
              Try Parchment Maps
            </Button>
          </div>
        </div>
      </div>

      <!-- Globe render target for hero placement (invisible) -->
      <div
        ref="heroTargetRef"
        class="absolute left-1/2 top-[50%] -translate-x-1/2 w-[200vw] md:w-[150vw] lg:w-[100vw]"
        style="aspect-ratio: 1/1"
      ></div>
    </section>

    <section
      id="try"
      class="relative snap-start bg-space text-parchment min-h-[100dvh] flex items-center"
    >
      <div class="flex flex-col items-left justify-left p-20">
        <h2
          class="font-serif text-[clamp(2rem,6vw,4rem)] leading-tight md:col-span-1"
        >
          Find your inner <span class="text-brand">Magellan</span>
        </h2>
        <p class="max-w-2xl text-base text-parchment/80 md:col-span-1">
          Sourcing from OpenStreetMap, the world’s most extensive map database,
          Parchment enables you to explore the entire earth, down to the most
          remote regions of the globe.
        </p>
        <Button class="w-fit" variant="primary">
          Become an OSM cartographer
        </Button>
      </div>
      <!-- Globe render target for Magellan placement (invisible) -->
      <div
        ref="tryTargetRef"
        class="absolute top-1/2 right-0 -translate-y-1/2 translate-x-[10%] w-[55vw] hidden md:block"
        style="aspect-ratio: 1/1; pointer-events: none"
      ></div>
    </section>

    <!-- Single fixed globe element positioned to nearest target -->
    <div
      ref="globeRef"
      class="pointer-events-none fixed z-[5]"
      style="
        left: 0;
        top: 0;
        width: 0;
        height: 0;
        will-change: transform;
        transform: translate3d(0, 0, 0) scale(1, 1);
      "
    >
      <div class="absolute inset-0 overflow-hidden">
        <HeroGlobe />
      </div>
    </div>
  </main>
</template>
