<script setup lang="ts">
import { ref } from "vue";
import { useForm, type SubmissionHandler } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { z } from "zod";
import { toast } from "vue-sonner";
import { LoaderCircle } from "lucide-vue-next";
import UiNavbar from "@/components/UiNavbar.vue";
import Button from "@/components/ui/button/Button.vue";
import Input from "@/components/ui/input/Input.vue";
import HeroGlobe from "@/components/HeroGlobe.client.vue";
import {
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormControl,
} from "@/components/ui/form";

// Staggered fade-up entrance for the hero elements (client-only via <ClientOnly>)
const fadeUp = (delay: number) =>
  ({
    initial: { opacity: 0, y: 24 },
    enter: { opacity: 1, y: 0, transition: { duration: 0.7, delay } },
  }) as const;

// Placeholder nav — no destination pages exist yet
const links = [
  { href: "#", label: "Download" },
  { href: "#", label: "Developers" },
  { href: "#", label: "Blog" },
  { href: "#", label: "Resources" },
  { href: "#", label: "Pricing" },
];

const WaitlistSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Please enter your name")
    .max(100, "Name is too long"),
  email: z.string().trim().toLowerCase().email("Please enter a valid email"),
});
type WaitlistValues = z.infer<typeof WaitlistSchema>;

// useForm() provides the field context to the <FormField>s below; isSubmitting
// is toggled automatically around the async submit handler.
const { handleSubmit, resetForm, isSubmitting } = useForm<WaitlistValues>({
  validationSchema: toTypedSchema(WaitlistSchema),
  initialValues: { name: "", email: "" },
});

// Globe fades in only once its texture has loaded and the first frame is
// rendered, so it never pops in as a dark, untextured sphere.
const globeReady = ref(false);

const abCookieName =
  (useRuntimeConfig().public.abCookieName as string) || "ab_variant";
const abVariant = useCookie<string>(abCookieName);

const onSubmit: SubmissionHandler<WaitlistValues> = async (values) => {
  try {
    const { message } = await $fetch("/api/waitlist", {
      method: "POST",
      body: {
        name: values.name,
        email: values.email,
        variant: abVariant.value || "A",
      },
    });
    toast.success(message || "You're on the list!");
    resetForm();
  } catch (err: any) {
    toast.error(err?.data?.message || err?.message || "Something went wrong");
  }
};

// handleSubmit validates first and only runs onSubmit when the form is valid.
const onFormSubmit = handleSubmit(onSubmit);
</script>

<template>
  <main class="snap-y snap-mandatory overflow-y-auto h-[100dvh]">
    <!-- The ground under the masked map: the deepest of the three paper tones,
         so the one colour showing through a translucent photograph is a token
         and not a hex nobody can find again. -->
    <section
      id="hero"
      class="relative min-h-[100dvh] snap-start overflow-hidden bg-paper-deep"
    >
      <!-- Parchment map background -->
      <div class="absolute inset-0 z-0">
        <img
          src="/map.webp"
          alt=""
          aria-hidden="true"
          fetchpriority="high"
          class="map-mask h-[100dvh] w-[100dvw] object-cover object-center"
        />
      </div>

      <!-- Nav bar -->
      <div class="relative z-30">
        <UiNavbar>
          <template #brand>
            <a href="/" class="flex shrink-0 items-center gap-2 text-base-dark">
              <svg
                class="size-[1.375rem]"
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
              <!-- The lockup, matched to barrelman's down to the metrics: the
                   display face at 18px with its baked-in leading dropped,
                   against a 1.375rem mark. It was set in the body sans at the
                   pill's inherited 14px, which made the wordmark half the
                   height of the mark beside it and the only place on either
                   site where the brand is not spelled in Exposure. -->
              <span class="display text-lg leading-none">Parchment</span>
            </a>
          </template>

          <li v-for="link in links" :key="link.label">
            <a :href="link.href" class="cursor-pointer transition-colors hover:text-base-dark">
              {{ link.label }}
            </a>
          </li>

          <template #cta>
            <Button href="https://parchment.app" variant="ghost" size="sm">
              Launch app →
            </Button>
          </template>
        </UiNavbar>
      </div>

      <!-- Hero content. `.measure` is the shared column — same max width and
           same gutter as every band on barrelman-landing, so the two sites
           set copy against the same left edge. -->
      <div
        class="measure relative z-10 flex h-[65dvh] flex-col items-center justify-center will-change-transform [transform-style:preserve-3d] [perspective:1000px]"
      >
        <ClientOnly>
          <div v-motion="fadeUp(0.1)">
            <!-- `.display` carries the face and the axis; only the leading is
                 set here, because this is a three-line stack of very large
                 type and the class's 1.02 opens a gap between the lines. -->
            <h1
              class="display max-w-4xl text-balance text-center text-[clamp(2rem,6vw,4.6rem)] leading-[0.9] text-base-dark"
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
          <div v-motion="fadeUp(0.25)">
            <p class="mt-7 max-w-2xl text-center text-lead leading-relaxed text-ink-soft">
              Explore the world with beautiful, detailed maps crafted by the
              community.
            </p>
          </div>
          <div v-motion="fadeUp(0.4)">
            <form class="mt-9 w-full max-w-xl" @submit.prevent="onFormSubmit">
              <!-- Stacked below sm. Three controls in a 375px row left the two
                   fields about 100px wide each, which is narrower than the
                   words in them; barrelman's hero takes the same escape with
                   `max-sm:w-full` on its pair of CTAs. -->
              <div class="flex flex-col gap-2 sm:flex-row sm:items-start">
                <FormField
                  v-slot="{ value, handleChange, handleBlur }"
                  name="name"
                >
                  <FormItem class="flex-1">
                    <FormLabel class="sr-only">Name</FormLabel>
                    <FormControl>
                      <Input
                        :model-value="value"
                        :disabled="isSubmitting"
                        name="name"
                        autocomplete="name"
                        placeholder="Name"
                        class="h-10 bg-parchment"
                        @update:model-value="handleChange"
                        @blur="handleBlur"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                </FormField>
                <FormField
                  v-slot="{ value, handleChange, handleBlur }"
                  name="email"
                >
                  <FormItem class="flex-[1.2]">
                    <FormLabel class="sr-only">Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        :model-value="value"
                        :disabled="isSubmitting"
                        name="email"
                        autocomplete="email"
                        inputmode="email"
                        placeholder="Email"
                        class="h-10 bg-parchment"
                        @update:model-value="handleChange"
                        @blur="handleBlur"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                </FormField>
                <Button
                  type="submit"
                  :disabled="isSubmitting"
                  :aria-busy="isSubmitting"
                  variant="dark"
                  size="md"
                  class="w-full sm:w-auto sm:min-w-36"
                >
                  <LoaderCircle v-if="isSubmitting" class="size-4 animate-spin" />
                  {{ isSubmitting ? "Joining..." : "Join waitlist" }}
                </Button>
              </div>
            </form>
          </div>
        </ClientOnly>
      </div>

      <!--
        The globe.

        Two numbers, and both are the projection rather than values found by
        nudging. <HeroGlobe> now sees 48.5° instead of 45° — the atmosphere
        does not fit a 45° frame, and what the top edge of this box used to cut
        was a live 8% of the glow, drawn as a horizontal rule across the map.

        Through 48.5° the r=1.06 sphere covers tan(asin(1.06/3.1)) / tan(24.25°)
        = 0.808 of the frame, against 0.878 through 45°. So the canvas grows by
        that ratio — 150vw becomes 163vw — and the planet on screen is exactly
        the size it was, with air around it instead of a cut.

        The lift is the difference between where the limb sits in the old frame
        and the new one: 0.0961 of the canvas above the limb now against 0.0608
        before, which against a 163vw box is 0.0402 of it. Without the lift the
        wider canvas would push the horizon down the page.

        `pointer-events-none` because the canvas is wider than the viewport and
        its top overlaps the bottom of the form: taking the pointer here would
        swallow clicks on the submit button.
      -->
      <div
        class="pointer-events-none absolute left-1/2 z-20 aspect-square w-[var(--globe)] -translate-x-1/2 transition-opacity duration-1000 ease-out"
        :class="globeReady ? 'opacity-100' : 'opacity-0'"
        style="--globe: 163vw; top: calc(50% - var(--globe) * 0.0402)"
      >
        <HeroGlobe @ready="globeReady = true" />
      </div>
    </section>
  </main>
</template>

<style scoped>
.map-mask {
  mask-image: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0.1),
    rgba(0, 0, 0, 0.5),
    rgba(0, 0, 0, 0.8)
  );
}
</style>
