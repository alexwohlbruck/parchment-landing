// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";
import {
  APP_URL,
  BARRELMAN_URL,
  DOCS_URL,
  GITHUB_URL,
  INSTAGRAM_URL,
  RELEASES_URL,
  THREADS_URL,
  X_URL,
} from "./app/lib/links";

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  css: ["~/assets/css/tailwind.css"],
  components: [
    {
      path: "~/components",
      extensions: ["vue"],
      pathPrefix: false,
    },
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  nitro: {
    // parchment.app deploys to Netlify, which serves SSR via functions — the
    // "bun" preset builds a standalone Bun server Netlify can't run (→ 404).
    preset: "netlify",
  },
  runtimeConfig: {
    // Google Apps Script web app that appends signups to the waitlist sheet.
    // Override per-environment with WAITLIST_SCRIPT_URL if the deployment changes.
    waitlistScriptUrl:
      process.env.WAITLIST_SCRIPT_URL ||
      "https://script.google.com/macros/s/AKfycbwBKEtllpubTQYU-cy_52rpie11r3M1xmAlGxn3xYjopsBhuGVjzLG6NTRrxoR-xYvHNA/exec",
    public: {
      abCookieName: "ab_variant",
      // Where the nav points, on barrelman-landing's pattern, so a staging
      // deploy can retarget any of them without a code change.
      //
      // The defaults come from app/lib/links.ts rather than being written out
      // again here. That file exists because the "Launch app" button once
      // pointed at the marketing site instead of the map app, and a second
      // copy of the address in this file is exactly how that happens again —
      // it is also what this merge had to undo, since the runtimeConfig added
      // on the feature branch had defaulted `appUrl` back to parchment.app.
      appUrl: process.env.PARCHMENT_APP_URL || APP_URL,
      docsUrl: process.env.PARCHMENT_DOCS_URL || DOCS_URL,
      githubUrl: GITHUB_URL,
      releasesUrl: RELEASES_URL,
      barrelmanUrl: process.env.BARRELMAN_URL || BARRELMAN_URL,
      // No env overrides on these: a staging deploy points at staging APIs,
      // not at a staging Instagram.
      xUrl: X_URL,
      threadsUrl: THREADS_URL,
      instagramUrl: INSTAGRAM_URL,
    },
  },
  app: {
    head: {
      title: "Parchment",
      meta: [
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        {
          name: "description",
          content:
            "A modern mapping and navigation app based on open data and open source software.",
        },
      ],
      link: [
        // Geist from the Google Fonts CDN, the same request barrelman-landing
        // makes, so the body copy on the two sites is one face served from one
        // place. The preconnects are what make it worth using a CDN at all:
        // without them the stylesheet and the woff2 behind it are two cold
        // connections on the critical path.
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        {
          rel: "preconnect",
          href: "https://fonts.gstatic.com",
          crossorigin: "anonymous",
        },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Geist:wght@400..700&display=swap",
        },
        {
          // Without this the hero title reflows once Exposure arrives, because
          // the @font-face is only discovered after the CSS parses.
          rel: "preload",
          as: "font",
          type: "font/woff2",
          href: "/fonts/Exposure.woff2",
          crossorigin: "anonymous",
        },
        {
          rel: "icon",
          type: "image/svg+xml",
          href: "/favicon.svg",
        },
        // Warm the globe textures early — they're otherwise only requested
        // after the JS bundle hydrates and three initializes.
        //
        // `crossorigin` because three's ImageLoader sets `crossOrigin =
        // 'anonymous'`: without it the preload key does not match the image
        // request and the browser downloads both textures a second time.
        {
          rel: "preload",
          as: "image",
          type: "image/webp",
          href: "/textures/earth_albedo.webp",
          crossorigin: "",
        },
        {
          rel: "preload",
          as: "image",
          type: "image/webp",
          href: "/textures/clouds.webp",
          crossorigin: "",
        },
      ],
    },
  },
});
