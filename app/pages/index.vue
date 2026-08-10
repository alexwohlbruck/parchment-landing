<script setup lang="ts">
import { ref } from "vue";
import { useForm, type SubmissionHandler } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { z } from "zod";
import { toast } from "vue-sonner";
import { Check, LoaderCircle, MailCheck } from "lucide-vue-next";
import UiNavbar from "@/components/UiNavbar.vue";
import Button from "@/components/ui/button/Button.vue";
import Input from "@/components/ui/input/Input.vue";
import HeroGlobe from "@/components/HeroGlobe.client.vue";
import ReleasePill from "@/components/ReleasePill.vue";
import type { LatestRelease } from "~~/server/api/release.get";
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

const { public: config } = useRuntimeConfig();

/**
 * The latest release, for the pill above the headline.
 *
 * Fetched here rather than inside <ReleasePill>, because the pill renders
 * under <ClientOnly> and a fetch in there would run once per visitor. The
 * endpoint is a cached same-origin proxy, so on the server this resolves out
 * of memory and the value travels down in the payload.
 */
const { data: release } = await useFetch<LatestRelease | null>(
  "/api/release",
  // The pill is an ornament: if GitHub is unreachable the hero renders with
  // one fewer element rather than erroring.
  { default: () => null }
);

/**
 * The nav, cut down to the links that have somewhere to go.
 *
 * All five of these used to be `href="#"`. A nav of dead links is worse than a
 * short one: it advertises a blog, a resources section and a pricing page that
 * do not exist, and the first thing a visitor learns about the product is that
 * its own header does not work.
 *
 * Blog, Resources and Pricing are commented out rather than deleted — they are
 * planned, and this is the list to add them back to.
 *
 * "Developers" is now "Docs", which is what it is. The old label named an
 * audience and left you guessing what was behind it.
 */
const links = [
  { href: config.releasesUrl, label: "Download", external: true },
  { href: config.docsUrl, label: "Docs", external: true },
  // { href: "#", label: "Blog" },
  // { href: "#", label: "Resources" },
  // { href: "#", label: "Pricing" },
  { href: config.barrelmanUrl, label: "Barrelman", external: true },
];

/**
 * The one action in the header. A prop rather than a slot because the nav
 * renders it twice — as a pill in the bar from `md` up, and at the foot of the
 * mobile sheet below it, where the links live too.
 */
const cta = { href: config.appUrl as string, label: "Launch app →" };

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

/**
 * The outcome of a signup, or null while there has not been one.
 *
 * The form is replaced by this rather than cleared. A toast was the only
 * feedback before, and a toast is the wrong shape for it: it appears away from
 * the thing you just used, it leaves after a few seconds, and it leaves behind
 * an empty form — which reads as "nothing happened, try again" to anyone who
 * looked away, and is how people end up submitting twice.
 *
 * The address is kept because it is the useful part of the confirmation: what
 * a person wants to know is not that a button worked, it is which mailbox to
 * watch, and whether they typed it correctly.
 */
const signup = ref<{ email: string; duplicate: boolean } | null>(null);

const onSubmit: SubmissionHandler<WaitlistValues> = async (values) => {
  try {
    const { duplicate } = await $fetch("/api/waitlist", {
      method: "POST",
      body: {
        name: values.name,
        email: values.email,
        variant: abVariant.value || "A",
      },
    });
    signup.value = { email: values.email, duplicate: Boolean(duplicate) };
    resetForm();
  } catch (err: any) {
    // Failures stay in a toast. They are the case where the form has to remain
    // on screen with what you typed still in it, so the message has nowhere
    // else to go.
    toast.error(err?.data?.message || err?.message || "Something went wrong");
  }
};

/** Back to the form — mostly for "already on the list", where the natural next
 *  thought is that you used a different address the first time. */
function signUpAgain() {
  signup.value = null;
}

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
        <UiNavbar :links="links" :cta="cta">
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
              <!-- Below 360 the mark carries the lockup alone. At that width
                   the wordmark is 89px the bar does not have, and the choice
                   is between dropping it and pushing the menu button out of
                   the pill — which is what was happening. The mark is the
                   brand's own object and reads as it on its own; a truncated
                   "Parchme…" would not. -->
              <span class="display text-lg leading-none max-[359px]:hidden">
                Parchment
              </span>
            </a>
          </template>
        </UiNavbar>
      </div>

      <!-- Hero content. `.measure` is the shared column — same max width and
           same gutter as every band on barrelman-landing, so the two sites
           set copy against the same left edge. -->
      <!--
        `pt-32 sm:pt-36` is barrelman's <SiteHero>, to the pixel, and it is a
        measured top edge rather than a centred one for that reason.

        Centring the stack in the first 65dvh put the pill 170px below the
        section top against barrelman's 144px — the rest of the rhythm below
        (28 / 28 / 36) was already identical, so this was the only gap in the
        hero that did not match, and it was the first one anybody sees. A
        centred block cannot match a measured one anyway: its top edge moves
        whenever the copy changes length.

        No `min-h` either. It was 65dvh, which made the column a viewport
        fraction rather than a stack of copy, and the globe hangs off its
        bottom edge — so the horizon was 149px below the form on a desktop and
        18px below it on a phone, for no reason either number could be traced
        to. The column is exactly as tall as what is in it now, and the globe
        takes a measured step from that.
      -->
      <div
        class="measure relative z-20 flex flex-col items-center pt-32 will-change-transform [transform-style:preserve-3d] [perspective:1000px] sm:pt-36"
      >
        <ClientOnly>
          <!-- What shipped most recently, above the headline, on the same
               pattern as barrelman's hero. It leads the stagger because it is
               the first line of the page: a visitor who already knows what
               Parchment is wants the news, not the pitch. -->
          <div v-motion="fadeUp(0)" class="mb-7 flex w-full justify-center">
            <ReleasePill :release="release" />
          </div>
          <div v-motion="fadeUp(0.1)">
            <!--
              The same heading barrelman sets: the same ramp, and `.display`'s
              own 1.02 leading rather than an override.

              It was clamp(2rem, 6vw, 4.6rem) at leading-[0.9] — 73.6px against
              barrelman's 62.4px, set 12% tighter. Same face, same axis, same
              400 weight, and it still read as a heavier typeface, because at
              that size and that leading it is a denser block of ink. Nothing
              about the font was ever different; the two numbers around it
              were.
            -->
            <h1
              class="display max-w-4xl text-balance text-center text-[clamp(2.2rem,5.2vw,3.9rem)] text-base-dark"
            >
              The
              <!-- No drop shadow. barrelman's blue is flat, and an offset
                   brown behind this one thickened every stem — which is most
                   of what read as a weight difference between the sites. -->
              <span class="text-brand">next generation</span>
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
          <!--
            The announcement lives here rather than on the panel below.

            The panel is `inert` whenever it is hidden, and an inert element is
            off the accessibility tree — so an `aria-live` on it would go
            unread, which is exactly the regression that keeping both states
            mounted introduces. This region is always present and never inert,
            so the text appearing in it is what gets spoken.
          -->
          <p class="sr-only" role="status" aria-live="polite">
            {{
              signup
                ? signup.duplicate
                  ? `We already have ${signup.email} on the waitlist.`
                  : `You are on the waitlist. We will email ${signup.email}.`
                : ""
            }}
          </p>

          <!--
            The waitlist slot.

            Both states are mounted and stacked in one grid cell, so this box
            is always as tall as the taller of them and swapping between them
            changes nothing about the layout. That matters because the globe
            hangs off the bottom of this column: with `v-if` the form gave way
            to a panel of a different height and the whole planet stepped up or
            down at the moment of submitting, which is the one moment the eye
            is already somewhere else.

            No fixed height doing it, so the reserve is whatever the states
            actually need at that width — which reverses between breakpoints:
            on a phone the stacked form is the taller, on a desktop the
            confirmation is.

            `inert` on whichever is hidden, so the invisible one is out of the
            tab order rather than merely transparent.
          -->
          <div v-motion="fadeUp(0.4)" class="mt-9 grid w-full max-w-xl">
            <!--
              The confirmation, in place of the form.

              Two states, not one. The endpoint has always known whether an
              address was already on the list — it is what the Apps Script
              returns — and both outcomes used to arrive as the same green
              toast, so the one piece of information a returning visitor wants
              was the one thing the page would not tell them.
            -->
            <!--
              Driven by `signup` rather than by `v-motion`. Both states are
              mounted now, so a mount-triggered animation fires on page load —
              while this panel is still invisible — and the arrival nobody was
              looking at is the only one that ever plays. A class transition
              replays every time the state actually changes, which is the
              moment worth animating.
            -->
            <div
              class="depth col-start-1 row-start-1 flex flex-col gap-3 self-start rounded-lg border border-rule-strong bg-parchment/85 px-4 py-3 text-left transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none sm:flex-row sm:items-center"
              :class="
                signup
                  ? 'translate-y-0 opacity-100'
                  : 'pointer-events-none translate-y-2 opacity-0'
              "
              :inert="!signup"
            >
              <div class="flex items-center gap-3">
                <!--
                  The mark is the one thing that moves on arrival; everything
                  else is already still by the time the eye reaches it.

                  Solid for a new signup, tinted for a returning one. A 12%
                  wash behind a stroked glyph was almost invisible against
                  paper, and the mark is what the eye lands on before it reads
                  a word. The duplicate case stays quiet on purpose: it is a
                  reassurance, not a celebration, and should not congratulate
                  somebody for doing nothing.
                -->
                <span
                  class="grid size-9 shrink-0 place-items-center rounded-full transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none"
                  :class="[
                    signup ? 'scale-100 delay-100' : 'scale-50',
                    signup?.duplicate
                      ? 'bg-paper-deep text-ink-soft'
                      : 'bg-brand text-parchment shadow-[0_1px_3px_rgba(0,147,242,0.4)]',
                  ]"
                >
                  <MailCheck
                    v-if="signup?.duplicate"
                    class="size-5"
                    stroke-width="1.75"
                  />
                  <Check v-else class="size-5" stroke-width="2.75" />
                </span>

                <div class="min-w-0">
                  <p class="font-medium text-base-dark">
                    {{
                      signup?.duplicate
                        ? "You're already on the list."
                        : "You're on the list."
                    }}
                  </p>
                  <!--
                    Wrapped, not truncated. The address is the whole point of
                    the line — it is how you check you typed it right — and on
                    a phone `truncate` cut it to "fresh-signup…", which hides
                    exactly the part worth reading.
                  -->
                  <p class="break-words text-caption text-ink-soft">
                    <template v-if="signup?.duplicate">
                      We have {{ signup?.email }} — no need to sign up twice.
                    </template>
                    <template v-else>
                      We'll email {{ signup?.email }} when Parchment opens up.
                    </template>
                  </p>
                </div>
              </div>

              <!-- Wrong address, or a different one. The likeliest next
                   thought after "already on the list" is that you used
                   another. Below the text on a phone, beside it once there is
                   room. -->
              <button
                type="button"
                class="shrink-0 self-start rounded-md px-2 py-1 text-caption text-ink-soft underline decoration-rule-strong underline-offset-4 transition-colors hover:text-base-dark hover:decoration-ink-soft sm:ml-auto sm:self-center"
                @click="signUpAgain"
              >
                {{ signup?.duplicate ? "Use another" : "Change" }}
              </button>
            </div>

            <form
              class="col-start-1 row-start-1 w-full self-start transition-opacity duration-200"
              :class="signup ? 'pointer-events-none opacity-0' : 'opacity-100'"
              :inert="!!signup"
              @submit.prevent="onFormSubmit"
            >
              <!-- Stacked below sm. Three controls in a 375px row left the two
                   fields about 100px wide each, which is narrower than the
                   words in them; barrelman's hero takes the same escape with
                   `max-sm:w-full` on its pair of CTAs.

                   Validation messages are positioned out of flow, under their
                   own field. In flow they grew the form, and the form is what
                   the globe's position is measured from — so a mistyped email
                   moved the planet. They also shoved the row itself down as
                   you typed, which is its own small cruelty. -->
              <div class="flex flex-col gap-2 sm:flex-row sm:items-start">
                <FormField
                  v-slot="{ value, handleChange, handleBlur }"
                  name="name"
                >
                  <FormItem class="relative flex-1">
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
                    <FormMessage class="absolute left-0 top-full mt-1" />
                  </FormItem>
                </FormField>
                <FormField
                  v-slot="{ value, handleChange, handleBlur }"
                  name="email"
                >
                  <FormItem class="relative flex-[1.2]">
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
                    <FormMessage class="absolute left-0 top-full mt-1" />
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

        Anchored to the bottom of the content column above it, not to the
        middle of the section.

        A viewport fraction was right for one viewport. The copy above it is a
        short block on a desktop and three or four times taller on a phone —
        the headline wraps to three lines, the form becomes three stacked rows
        — while the horizon stayed at a fixed fraction of the section, so the
        limb came up through the email field. Measured at 375x812 the overlap
        was 78px; the breakpoint that fixed it left 0px of clearance at exactly
        640 and 7px at 768, which is the shape of a number being nudged rather
        than derived.

        The wrapper is an empty relative box in flow, so its `top: 0` *is* the
        column's bottom edge, whatever the column turned out to be. The canvas
        is then pulled up by exactly the distance from its own top to the limb
        — 0.0961 of it, see below — which puts the horizon a fixed step under
        the copy at every width, with no breakpoints in it at all.

        The step is 5rem, and it is the one number in this hero that is not on
        barrelman's scale.

        It was 3.5rem — `mt-14`, the step barrelman takes from its CTA row down
        to the demo widget — on the reasoning that the rhythm should not gain a
        fifth number just because the next block happens to be a planet. That
        was measuring the wrong edge. Barrelman steps down to a panel with a
        border: its top edge is where it begins. The globe's atmosphere is
        brightest at the limb and fades upward through roughly 12vw of canvas
        above it, so at an identical 56px the planet reads as arriving well
        before the number says it does, and it crowded the form.

        5rem restores the gap the scale was trying to describe. The scale is
        for type; this is the distance at which a light source stops leaning on
        an input.

        The two constants:

        <HeroGlobe> sees 48.5° rather than 45°, because the atmosphere does not
        fit a 45° frame — the top edge of this box used to cut a live 8% of the
        glow and draw it as a horizontal rule across the map. Through 48.5° the
        r=1.06 sphere covers tan(asin(1.06/3.1)) / tan(24.25°) = 0.808 of the
        frame, against 0.878 through 45°, so the canvas grows by that ratio —
        150vw became 163vw — and the planet on screen is the size it always
        was, with air around it instead of a cut.

        That leaves (1 - 0.808) / 2 = 0.0961 of the canvas above the limb,
        which is the offset the wrapper applies.

        It is draggable, as barrelman's is, which is a stacking change rather
        than a new feature — <HeroGlobe> has always had the handlers, and this
        box was `pointer-events-none` so they could never fire.

        The canvas is far taller than the globe you can see: at 1280 its top
        edge is 144px *above* the bottom of the copy, so with the globe on top
        it covered the form and swallowed clicks on the submit button. Putting
        the copy above it instead solves that exactly, because the two only
        overlap where the copy is: the column's box ends where the copy ends,
        and the limb appears 56px below that. Every pixel of visible planet is
        outside the column and takes the pointer; every pixel of form is inside
        it and keeps it.
      -->
      <!-- `select-none`, as barrelman's globe box has: without it a drag that
           starts on the planet and travels up the page selects the headline
           and the form labels on its way, which is the browser's default
           reading of a press-and-move over a document. -->
      <div class="relative z-10 select-none">
        <div
          class="absolute left-1/2 aspect-square w-[var(--globe)] -translate-x-1/2 transition-opacity duration-1000 ease-out"
          :class="globeReady ? 'opacity-100' : 'opacity-0'"
          style="--globe: 163vw; top: calc(3.5rem - var(--globe) * 0.0961)"
        >
          <HeroGlobe @ready="globeReady = true" />
        </div>
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
