import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // AgenticMeadows brand palette
        turf: {
          50: "#f2f3ee",
          100: "#e8e6e0",
          200: "#c9cdc2",
          300: "#a0a793",
          400: "#69785a",
          500: "#5a695a",
          600: "#3c4b3c",
          700: "#2d3a2d",
          800: "#1e2e1e",
          900: "#1e1e0f",
          950: "#0f0f08",
        },
        soil: {
          50: "#f5f0e8",
          100: "#ece3d4",
          200: "#d9c7aa",
          300: "#c4a87a",
          400: "#78694b",
          500: "#695a3c",
          600: "#5a4a30",
          700: "#4a3c26",
          800: "#3a2e1d",
          900: "#2d2d1e",
          950: "#1a1608",
        },
        am: {
          bg: "#e8e6e0",
          "green-dark": "#3c4b3c",
          "green-mid": "#5a695a",
          "green-light": "#69785a",
          copper: "#695a3c",
          "brown-warm": "#78694b",
          "text-primary": "#1e1e0f",
          "text-secondary": "#2d2d1e",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
} satisfies Config;
