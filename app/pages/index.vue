<script setup lang="ts">
import { ref } from "vue";
import { useForm, type SubmissionHandler } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { z } from "zod";
import { toast } from "vue-sonner";
import UiNavbar from "@/components/UiNavbar.vue";
import Button from "@/components/ui/button/Button.vue";
import Input from "@/components/ui/input/Input.vue";
import HeroGlobe from "@/components/HeroGlobe.client.vue";
import {
  Form,
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

const form = useForm<WaitlistValues>({
  validationSchema: toTypedSchema(WaitlistSchema),
  initialValues: { name: "", email: "" },
});

const submitting = ref(false);

const abCookieName =
  (useRuntimeConfig().public.abCookieName as string) || "ab_variant";
const abVariant = useCookie<string>(abCookieName);

const onSubmit: SubmissionHandler<WaitlistValues> = async (values) => {
  submitting.value = true;
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
    form.resetForm();
  } catch (err: any) {
    toast.error(err?.data?.message || err?.message || "Something went wrong");
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <main class="snap-y snap-mandatory overflow-y-auto h-[100dvh]">
    <section
      id="hero"
      class="relative min-h-[100dvh] overflow-hidden bg-[#E3D9CF] snap-start"
    >
      <!-- Parchment map background -->
      <div class="absolute inset-0 z-0">
        <img
          src="/map.png"
          alt=""
          aria-hidden="true"
          class="map-mask h-[100dvh] w-[100dvw] object-cover object-center"
        />
      </div>

      <!-- Nav bar -->
      <div class="relative z-30">
        <UiNavbar>
          <template #brand>
            <a href="/" class="flex items-center gap-2 text-base-dark">
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
            </a>
          </template>

          <li v-for="link in links" :key="link.label">
            <a
              :href="link.href"
              class="cursor-pointer text-base-dark/70 hover:text-base-dark rounded"
            >
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

      <!-- Hero content -->
      <div
        class="relative z-10 mx-auto flex w-[min(1100px,92%)] max-w-5xl h-[65dvh] flex-col items-center justify-center will-change-transform [transform-style:preserve-3d] [perspective:1000px]"
      >
        <ClientOnly>
          <div v-motion="fadeUp(0.1)">
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
          <div v-motion="fadeUp(0.25)">
            <p class="mt-4 max-w-2xl text-center text-[1.1rem] text-base-dark/80">
              Explore the world with beautiful, detailed maps crafted by the
              community.
            </p>
          </div>
          <div v-motion="fadeUp(0.4)">
            <Form
              class="mt-6 w-full max-w-xl"
              as="form"
              @submit="form.handleSubmit(onSubmit)"
            >
              <div class="flex gap-2">
                <FormField
                  v-slot="{ value, handleChange, handleBlur }"
                  name="name"
                >
                  <FormItem class="flex-1">
                    <FormLabel class="sr-only">Name</FormLabel>
                    <FormControl>
                      <Input
                        :model-value="value"
                        placeholder="Name"
                        class="shadow bg-white h-10"
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
                        placeholder="Email"
                        class="shadow bg-white h-10"
                        @update:model-value="handleChange"
                        @blur="handleBlur"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                </FormField>
                <Button
                  type="submit"
                  :disabled="submitting"
                  variant="dark"
                  size="md"
                  class="shadow min-w-36"
                >
                  {{ submitting ? "Joining..." : "Join waitlist" }}
                </Button>
              </div>
            </Form>
          </div>
        </ClientOnly>
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
