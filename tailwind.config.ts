import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        obsidian: {
          950: "#050507",
          900: "#070709",
          850: "#0b0c10",
          800: "#101117",
          750: "#14161f",
          700: "#1a1d29",
          600: "#242838",
        },
        roblox: {
          dark: "#1e1e24",
          card: "#25252b",
          border: "#33333d",
          accent: "#00a2ff",
          green: "#00b06f",
          red: "#f53b57"
        }
      },
    },
  },
  plugins: [],
};
export default config;
