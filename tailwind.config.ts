import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        mosque: {
          ink: "#17352f",
          green: "#2f6f4e",
          leaf: "#79a94b",
          mint: "#eaf3e6",
          gold: "#c58b22",
          sky: "#2f7f9f",
        },
      },
      boxShadow: {
        soft: "0 18px 60px rgba(23, 53, 47, 0.10)",
      },
    },
  },
  plugins: [],
};

export default config;
