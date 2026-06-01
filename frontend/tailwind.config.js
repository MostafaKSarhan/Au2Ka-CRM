/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#09090b',
        card: '#18181b',
        primary: {
          DEFAULT: '#6d28d9',
          hover: '#5b21b6',
        },
        accent: {
          DEFAULT: '#06b6d4',
          hover: '#0891b2',
        },
        border: '#27272a',
        muted: '#71717a',
      },
    },
  },
  plugins: [],
}
