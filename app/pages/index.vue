<script setup lang="ts">
const { data: auth } = await useFetch("/api/auth-status");
import { onMounted, ref } from "vue";
import UiNavbar from "@/components/UiNavbar.vue";
import Button from "@/components/ui/button/Button.vue";
import Input from "@/components/ui/input/Input.vue";
import HeroGlobe from "@/components/HeroGlobe.client.vue";

const motionNav = {
  initial: { opacity: 0, y: -100 },
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

const links = [
  { href: "/download", label: "Download" },
  { href: "/developers", label: "Developers" },
  { href: "/blog", label: "Blog" },
  { href: "/resources", label: "Resources" },
  { href: "/pricing", label: "Pricing" },
];
</script>

<template>
  <main class="snap-y snap-mandatory overflow-y-auto h-[100dvh]">
    <section
      id="hero"
      class="relative min-h-[100dvh] overflow-hidden bg-[#E3D9CF] snap-start"
    >
      <!-- Parchment map bg -->
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

      <!-- Nav bar -->
      <div class="relative z-30">
        <UiNavbar>
          <template #brand>
            <div
              class="flex items-center gap-2 text-base-dark cursor-pointer"
              href="/"
            >
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
          <li v-for="link in links" :key="link.href">
            <a
              href="#"
              class="cursor-pointer text-base-dark/70 hover:text-base-dark rounded"
            >
              {{ link.label }}
            </a>
          </li>

          <template #cta>
            <Button href="https://parchment.app" variant="ghost" size="sm"
              >Launch app →</Button
            >
          </template>
        </UiNavbar>
      </div>

      <!-- Hero content -->
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
            digital maps
          </h1>
        </div>
        <div v-if="isClient" v-motion="motionP">
          <p class="mt-4 max-w-2xl text-center text-[1.1rem] text-base-dark/80">
            Explore the world with beautiful, detailed maps crafted by the
            community.
          </p>
        </div>
        <div v-if="isClient" v-motion="motionCtas">
          <div class="mt-6 flex gap-2">
            <!-- <Button variant="outline" size="md" class="shadow">Download</Button> -->
            <Input
              variant="outline"
              class="shadow bg-white h-10"
              placeholder="Name"
            />
            <Input
              type="email"
              placeholder="Email"
              variant="outline"
              class="shadow bg-white h-10"
            />
            <Button href="#" variant="dark" size="md" class="shadow" disabled>
              Join waitlist
            </Button>
          </div>
        </div>
      </div>

      <!-- Globe -->
      <div
        class="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 w-[150vw] z-20"
        style="aspect-ratio: 1/1"
      >
        <HeroGlobe />
      </div>
    </section>
  </main>
</template>
