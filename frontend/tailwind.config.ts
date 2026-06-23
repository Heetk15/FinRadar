import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: "#0B1020",
          panel: "#111827",
          panelDark: "#0F172A",
          accent: "#10b981",
          accentDark: "#047857",
        },
      },
    },
  },
  plugins: [],
};

export default config;
