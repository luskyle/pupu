/** @type {import('tailwindcss').Config} */
import { heroui } from "@heroui/react";

module.exports = {
  content: ["./src/**/*.{tsx,html}", "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  // prefix: "plasmo-",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      keyframes: {
        "modal-in": {
          "0%": { opacity: "0", transform: "scale(0.96) translateY(4px)" },
          "100%": { opacity: "1", transform: "none" },
        },
        "modal-out": {
          "0%": { opacity: "1", transform: "none" },
          "100%": { opacity: "0", transform: "scale(0.96) translateY(4px)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "fade-out": {
          "0%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
        "dots-slide": {
          "0%": { transform: "translateX(0)", opacity: "0" },
          "15%": { opacity: "1" },
          "85%": { transform: "translateX(186px)", opacity: "1" },
          "100%": { transform: "translateX(186px)", opacity: "0" },
        },
      },
      animation: {
        "modal-in": "modal-in 0.12s ease-out",
        "modal-out": "modal-out 0.1s ease-in forwards",
        "fade-in": "fade-in 0.12s ease-out",
        "fade-out": "fade-out 0.1s ease-in forwards",
        "dots-slide": "dots-slide 1.6s ease-in-out forwards",
      },
    },
  },
  plugins: [heroui({ addCommonColors: true, defaultTheme: "light" })],
};
