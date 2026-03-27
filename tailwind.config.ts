import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0a0a0f",
        surface: "#12121a",
        card: "#1a1a26",
        "card-hover": "#1e1e2e",
        border: "#2a2a3d",
        gold: "#e8c46a",
        "gold-dim": "#a88c48",
        accent: "#e85d4a",
        green: "#4ae8a0",
        muted: "#7a7a9a",
        horror: "#c44ae8",
      },
    },
  },
  plugins: [],
};
export default config;
