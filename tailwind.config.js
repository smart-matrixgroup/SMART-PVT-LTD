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
        midnight: '#06112B',
        navy: {
          950: '#040D1F',
          900: '#06112B',
          800: '#0A1838',
          700: '#0E214B',
          600: '#142C63',
          500: '#1C3E8A',
        },
        primary: {
          DEFAULT: '#126BFF',
          hover: '#0D58D8',
          electric: '#1787FF',
          cyan: '#00D9FF',
          dark: '#0B47B8',
        },
        accent: {
          cyan: '#00D9FF',
          glow: 'rgba(0, 217, 255, 0.25)',
          blueGlow: 'rgba(23, 135, 255, 0.3)',
        },
        surface: {
          dark: '#0A1838',
          darker: '#06112B',
          card: 'rgba(14, 33, 75, 0.65)',
          cardHover: 'rgba(20, 44, 99, 0.85)',
          border: '#20345D',
          borderHighlight: 'rgba(0, 217, 255, 0.35)',
          light: '#F4F7FC',
          lightCard: '#FFFFFF',
          lightBorder: '#DCE4F2',
        },
        text: {
          light: '#FFFFFF',
          soft: '#EAF1FF',
          muted: '#91A0BC',
          dark: '#0A1838',
          darkMuted: '#475569',
        },
        status: {
          success: '#18C77A',
          warning: '#F5B942',
          danger: '#F05A67',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        heading: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
      },
      backgroundImage: {
        'hero-gradient': 'radial-gradient(circle at 50% 20%, rgba(18, 107, 255, 0.18) 0%, rgba(6, 17, 43, 0.95) 70%)',
        'grid-pattern': 'linear-gradient(to right, rgba(32, 52, 93, 0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(32, 52, 93, 0.15) 1px, transparent 1px)',
        'cyan-glow': 'radial-gradient(circle, rgba(0, 217, 255, 0.15) 0%, transparent 70%)',
      },
      boxShadow: {
        'glow-sm': '0 0 15px rgba(23, 135, 255, 0.25)',
        'glow-md': '0 0 25px rgba(23, 135, 255, 0.35)',
        'glow-cyan': '0 0 25px rgba(0, 217, 255, 0.35)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        }
      }
    },
  },
  plugins: [],
}

