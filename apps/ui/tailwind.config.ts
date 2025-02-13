import { type Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#2e026d",
          50: "#f8f6fe",
          100: "#f0ecfd",
          200: "#e3dbfb",
          300: "#cebef7",
          400: "#b498f2",
          500: "#9969eb",
          600: "#8544e1",
          700: "#7434ca",
          800: "#602ca6",
          900: "#512986",
          950: "#2e026d",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
