// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";

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
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        {
          rel: "preconnect",
          href: "https://fonts.gstatic.com",
          crossorigin: "anonymous",
        },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Inter:wght@400;500;600;700&display=swap",
        },
        {
          rel: "icon",
          type: "image/svg+xml",
          href: "/favicon.svg",
        },
        // Warm the globe textures early — they're otherwise only requested
        // after the JS bundle hydrates and Three.js initializes.
        {
          rel: "preload",
          as: "image",
          href: "/textures/earth_albedo.webp",
        },
        {
          rel: "preload",
          as: "image",
          href: "/textures/clouds.webp",
        },
      ],
    },
  },
});
