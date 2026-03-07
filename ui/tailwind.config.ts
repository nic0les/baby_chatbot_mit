import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Karla", "sans-serif"],
        serif: [
          "Baskerville",
          "Baskerville Old Face",
          "Hoefler Text",
          "Georgia",
          "serif",
        ],
      },
      colors: {
        bg: "#f5f3ef",
        surface: "#ffffff",
        border: "#e5e2dc",
        mit: "#A31F34",
        "mit-light": "rgba(163,31,52,0.08)",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04)",
        modal:
          "0 20px 60px -10px rgba(0,0,0,0.18), 0 8px 20px -6px rgba(0,0,0,0.10)",
      },
    },
  },
  plugins: [],
};

export default config;
