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
        parchment: {
          50: '#fdfbf7',
          100: '#f9f6ef',
          200: '#f2ecdf',
          300: '#e5dbcb',
          400: '#d0beab',
          500: '#b89f88',
          600: '#9b7e68',
          700: '#7d6352',
          800: '#645144',
          900: '#4e3f36',
          950: '#2a211c',
        },
        ink: {
          50: '#f4f6f8',
          100: '#e7eaee',
          200: '#ced5df',
          300: '#a6b5c6',
          400: '#7790aa',
          500: '#54718f',
          600: '#415975',
          700: '#34475e',
          800: '#2d3b4e',
          900: '#1e2633',
          950: '#0f141c',
        },
        brand: {
          50: '#fffbeb',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        }
      },
      fontFamily: {
        serif: ['Lora', 'Georgia', 'Cambria', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(0, 0, 0, 0.05), 0 2px 6px -1px rgba(0, 0, 0, 0.03)',
        'elevated': '0 10px 30px -4px rgba(0, 0, 0, 0.1), 0 4px 12px -2px rgba(0, 0, 0, 0.06)',
      }
    },
  },
  plugins: [],
}
