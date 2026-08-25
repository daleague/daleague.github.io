import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Stadium-at-night base surfaces
        base: "#0B0F1A",
        surface: "#121729",
        card: "#171D33",
        "card-raised": "#1D2440",
        hairline: "#262E4A",
        // Text
        ink: "#F4F6FB",
        muted: "#8B93B0",
        faint: "#5B6280",
        // Broadcast accent trio
        gold: {
          DEFAULT: "#FFC145",
          dim: "#8A6A22",
        },
        live: {
          DEFAULT: "#FF4D3D",
          dim: "#7A2A22",
        },
        win: {
          DEFAULT: "#35D07F",
          dim: "#1F5C3E",
        },
        ice: {
          DEFAULT: "#4FD1E8",
          dim: "#295B66",
        },
      },
      fontFamily: {
        score: ["Teko", "sans-serif"],
        display: ["Oswald", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["\"JetBrains Mono\"", "monospace"],
      },
      backgroundImage: {
        "field-fade":
          "radial-gradient(120% 120% at 50% -10%, rgba(255,193,69,0.10) 0%, rgba(11,15,26,0) 55%)",
      },
      boxShadow: {
        card: "0 1px 0 rgba(255,255,255,0.03) inset, 0 20px 40px -24px rgba(0,0,0,0.6)",
      },
      keyframes: {
        ticker: {
          "0%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-50%)" },
        },
        pulseDot: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.3" },
        },
      },
      animation: {
        ticker: "ticker 32s linear infinite",
        "pulse-dot": "pulseDot 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
