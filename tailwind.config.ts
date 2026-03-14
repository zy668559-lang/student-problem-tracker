import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#163047",
        slate: "#4e6376",
        mist: "#eef5f7",
        line: "#d8e3e8",
        accent: "#0f766e",
        gold: "#c28c2c",
        rose: "#9f3a48"
      },
      boxShadow: {
        panel: "0 18px 50px rgba(18, 47, 74, 0.08)"
      },
      borderRadius: {
        panel: "24px"
      }
    }
  },
  plugins: []
};

export default config;
