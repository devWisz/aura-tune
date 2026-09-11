/** @type {import('tailwindcss').Config} */
const withAlpha = (variable) => `rgb(var(${variable}) / <alpha-value>)`;

module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: withAlpha("--bg"),
        raised: withAlpha("--bg-raised"),
        sunken: withAlpha("--bg-sunken"),
        panel: withAlpha("--panel"),
        line: withAlpha("--line"),
        "line-soft": withAlpha("--line-soft"),
        ink: withAlpha("--text"),
        dim: withAlpha("--text-dim"),
        faint: withAlpha("--text-faint"),
        accent: withAlpha("--accent"),
        accent2: withAlpha("--accent-2"),
        warm: withAlpha("--accent-warm"),
        danger: withAlpha("--danger"),
        ok: withAlpha("--ok"),
      },
      fontFamily: {
        mono: [
          "ui-monospace",
          "SF Mono",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      animation: {
        "fade-up": "at-fade-up 0.28s cubic-bezier(0.22, 1, 0.36, 1) both",
        "pop-in": "at-pop-in 0.22s cubic-bezier(0.22, 1, 0.36, 1) both",
        "ping-ring": "at-ping-ring 1.8s cubic-bezier(0, 0, 0.2, 1) infinite",
      },
    },
  },
  plugins: [],
};
