// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  modules: ["@nuxtjs/tailwindcss"],
  css: ["~/assets/css/tailwind.css"],
  nitro: {
    preset: "bun",
  },
  app: {
    head: {
      title: "Parchment Maps",
      meta: [
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        {
          name: "description",
          content:
            "Open-source Google Maps alternative. Fast, private, and developer-friendly.",
        },
      ],
    },
  },
});
