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
        primary: {
          50: 'rgb(239, 246, 255)',   // blue-50
          600: 'rgb(37, 99, 235)',    // blue-600 (primary)
          700: 'rgb(29, 78, 216)',    // blue-700
        },
        secondary: {
          600: 'rgb(147, 51, 234)',   // purple-600
          700: 'rgb(126, 34, 206)',   // purple-700
        },
        slate: {
          50: 'rgb(248, 250, 252)',   // background
          200: 'rgb(226, 232, 240)',  // borders
          600: 'rgb(71, 85, 105)',    // text secondary
          800: 'rgb(30, 41, 59)',     // text primary
        }
      }
    }
  },
  plugins: [],
};
export default config;
