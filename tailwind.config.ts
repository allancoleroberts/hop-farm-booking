import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Hop Farm Beach brand colors
        stone: {
          50: "#fafaf9",
          100: "#f5f5f4",
          200: "#e7e5e4",
          300: "#d6d3d1",
          400: "#a8a29e",
          500: "#78716c",
          600: "#57534e",
          700: "#44403c",
          800: "#292524",
          900: "#1c1917",
        },
        sand: {
          DEFAULT: "#b8a68a",
          light: "#d4c4a8",
          dark: "#9a8a70",
        },
        forest: {
          DEFAULT: "#4a5c4a",
          light: "#6b7d6b",
          dark: "#3a4a3a",
        },
        cream: "#fffff8",
      },
      fontFamily: {
        roobert: ["Roobert", "system-ui", "sans-serif"],
        dreamers: ["TheDreamersEdition", "cursive"],
      },
    },
  },
  plugins: [],
} satisfies Config;
