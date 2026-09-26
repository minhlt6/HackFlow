/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
        },
        brand: {
          dark: '#0f172a',
          surface: '#1e293b',
          border: '#334155',
          accent: '#38bdf8',
        }
      }
    },
  },
  plugins: [],
}
