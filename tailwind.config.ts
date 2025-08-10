import type { Config } from "tailwindcss";

export default <Partial<Config>>{
  content: [
    "./components/**/*.{vue,js,ts}",
    "./layouts/**/*.vue",
    "./pages/**/*.vue",
    "./app.vue",
    "./app/**/*.{vue,js,ts}",
    "./plugins/**/*.{js,ts}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0093F2",
        },
        base: {
          dark: "#3F2F1E",
          light: "#CBBDAD",
        },
        space: "#081628",
        parchment: "#FFF9F3",
        shadow: "rgba(63,47,30,0.25)",
      },
      fontFamily: {
        serif: ["DM Serif Display", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
};
