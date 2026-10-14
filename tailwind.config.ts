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
