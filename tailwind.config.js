/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
      colors: {
        navy: {
          50:  '#e8edf5',
          100: '#c5d0e8',
          200: '#9fb0d8',
          300: '#7890c8',
          400: '#5a78bc',
          500: '#3c60b0',
          600: '#2d4d96',
          700: '#1e3a7c',
          800: '#132862',
          900: '#0B1F35',
          950: '#060f1a',
        },
        solar: {
          50:  '#fff9e6',
          100: '#ffedb3',
          200: '#ffe080',
          300: '#ffd34d',
          400: '#ffc61a',
          500: '#e6ac00',
          600: '#b38600',
          700: '#806000',
          800: '#4d3900',
          900: '#1a1300',
        }
      }
    }
  },
  plugins: []
}
