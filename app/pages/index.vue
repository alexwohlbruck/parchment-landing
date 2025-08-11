<script setup lang="ts">
const { data: auth } = await useFetch("/api/auth-status");
import { onMounted, ref, onBeforeUnmount } from "vue";
import UiNavbar from "@/components/UiNavbar.vue";
import UiButton from "@/components/UiButton.vue";
import { useGlobeMover } from "@/composables/useGlobeMover";
import HeroGlobe from "@/components/HeroGlobe.client.vue";

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
  const els = Array.from(
    document.querySelectorAll(".hero-tilt")
  ) as HTMLElement[];
  if (!root || !els.length) return;

  let ended = 0;
  els.forEach((el, i) => {
    el.style.transformOrigin = "50% 50%";
    el.style.transformStyle = "preserve-3d";
    el.style.animation = `heroIn 3s cubic-bezier(0.22, 1, 0.36, 1) both`; // ends at normal state
    el.style.animationDelay = `${i * 0.25}s`;
    el.addEventListener(
      "animationend",
      () => {
        ended++;
        // ensure final non-transformed state
        el.style.opacity = "1";
        el.style.transform = "none";
        if (ended === els.length) {
          const updateTilt = () => {
            const y = root!.scrollTop;
            const h = root!.clientHeight;
            const p = Math.min(1, y / (h * 0.6));
            els.forEach((item, j) => {
              const delay = j * 0.06;
              const t = Math.max(0, p - delay);
              const rot = (1 - t) * 8;
              const dz = (1 - t) * 60;
              item.style.transform = `rotateX(${rot}deg) translateZ(${dz}px)`;
            });
          };
          root!.addEventListener("scroll", updateTilt, { passive: true });
          updateTilt();
        }
      },
      { once: true }
    );
  });

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

  root.addEventListener("scroll", scrollHandler, { passive: true });
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
            class="cursor-pointer text-base-dark/70 hover:text-base-dark rounded px-1"
            >Home</a
          >
        </li>
        <li>
          <a
            href="#"
            class="cursor-pointer text-base-dark/70 hover:text-base-dark rounded px-1"
            >Maps</a
          >
        </li>
        <li>
          <a
            href="#"
            class="cursor-pointer text-base-dark/70 hover:text-base-dark rounded px-1"
            >Download</a
          >
        </li>
        <li>
          <a
            href="#"
            class="cursor-pointer text-base-dark/70 hover:text-base-dark rounded px-1"
            >Developers</a
          >
        </li>
        <li>
          <a
            href="#"
            class="cursor-pointer text-base-dark/70 hover:text-base-dark rounded px-1"
            >Demo</a
          >
        </li>
        <template #cta>
          <UiButton href="#" variant="ghost" size="sm">Launch app →</UiButton>
        </template>
      </UiNavbar>

      <div
        class="relative z-10 mx-auto flex w-[min(1100px,92%)] max-w-5xl h-[65dvh] flex-col items-center justify-center will-change-transform [transform-style:preserve-3d] [perspective:1000px]"
      >
        <h1
          class="hero-tilt text-center font-serif text-[clamp(2rem,6vw,4.6rem)] leading-[0.9] text-base-dark"
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
        <p
          class="hero-tilt mt-4 max-w-2xl text-center text-[1.1rem] text-base-dark/80"
        >
          Explore the world with beautiful, detailed maps crafted by the
          community.
        </p>
        <div class="hero-tilt mt-6 flex gap-3">
          <UiButton variant="outline" size="md">Download</UiButton>
          <UiButton href="#" variant="primary" size="md"
            >Try Parchment Maps</UiButton
          >
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
        <UiButton class="w-fit" variant="outline"
          >Become an OSM cartographer</UiButton
        >
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

<style>
/* Globe uses JS to animate left/top/width/height via transitions */
</style>
