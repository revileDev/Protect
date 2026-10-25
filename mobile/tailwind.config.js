/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        obsidian: {
          700: "#222634",
          800: "#161922",
          850: "#11141c",
          900: "#0c0e14",
          950: "#07080c",
        },
      },
    },
  },
  plugins: [],
};
