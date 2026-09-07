/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      screens: {
        'xs': '420px',
      },
      colors: {
        sathi: {
          50: '#FDF8F3',
          100: '#FBF0E4',
          200: '#F7DEC6',
          300: '#F2C69E',
          400: '#EAA56D',
          500: '#E2833F',
          600: '#D26727',
          700: '#AF4D1B',
          800: '#8C3E1B',
          900: '#72341A',
        },
        sage: {
          50: '#F4F7F5',
          100: '#E5EDE7',
          200: '#CDDDCF',
          300: '#A9C4AD',
          400: '#7FA486',
          500: '#5F8867',
          600: '#496D50',
          700: '#3C5741',
          800: '#324736',
          900: '#2B3B2E',
        },
        calm: {
          blue: '#1E3A8A',
          teal: '#0F766E',
          gold: '#B45309',
          crimson: '#991B1B',
        }
      },
      fontFamily: {
        sans: ['"Outfit"', '"Inter"', 'system-ui', 'sans-serif'],
        display: ['"Outfit"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'elder': '0 4px 14px 0 rgba(0, 0, 0, 0.08)',
        'elder-hover': '0 8px 24px 0 rgba(0, 0, 0, 0.12)',
        'tactile': '0 6px 0 0 rgba(0, 0, 0, 0.12)',
        'tactile-pressed': '0 2px 0 0 rgba(0, 0, 0, 0.12)',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        }
      }
    },
  },
  plugins: [],
}
