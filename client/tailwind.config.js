/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#ffffff",
        foreground: "#0a0a0a",
        muted: {
          DEFAULT: "#737373",
          foreground: "#525252",
          background: "#f5f5f5",
        },
        border: "#e5e5e5",
        card: "#ffffff",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
        mono: [
          '"SF Mono"',
          "Monaco",
          "Inconsolata",
          '"Fira Mono"',
          '"Droid Sans Mono"',
          '"Source Code Pro"',
          "monospace",
        ],
      },
    },
  },
  plugins: [],
}
