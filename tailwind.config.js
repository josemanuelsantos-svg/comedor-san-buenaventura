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
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
        },
        infantil: {
          bg: '#fdf2f8',
          border: '#fbcfe8',
          text: '#db2777',
        },
        primaria: {
          bg: '#f0fdf4',
          border: '#bbf7d0',
          text: '#16a34a',
        }
      }
    },
  },
  plugins: [],
}