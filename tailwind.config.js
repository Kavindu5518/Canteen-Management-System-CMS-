/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#F4A11B',
          50:  '#FFF8EC',
          100: '#FEEFD1',
          200: '#FDD98A',
          300: '#FCC451',
          400: '#FBAE1E',
          500: '#F4A11B',
          600: '#D4850D',
          700: '#A8650A',
          800: '#7D4B07',
          900: '#513005',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          muted: '#F8F8F8',
          card: '#FFFFFF',
        },
        dark: {
          DEFAULT: '#1A1A1A',
          nav: '#121212',
          card: '#1E1E1E',
        },
        text: {
          primary: '#1A1A1A',
          secondary: '#6B6B6B',
          muted: '#9B9B9B',
          inverse: '#FFFFFF',
        },
        success: '#22C55E',
        warning: '#F59E0B',
        danger: '#EF4444',
        info: '#3B82F6',
      },
      fontFamily: {
        sans: ['var(--font-nunito)', 'Nunito', 'sans-serif'],
        display: ['var(--font-nunito)', 'Nunito', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        card: '0 2px 12px rgba(0,0,0,0.08)',
        'card-hover': '0 8px 24px rgba(0,0,0,0.12)',
        primary: '0 4px 16px rgba(244,161,27,0.35)',
        'primary-lg': '0 8px 32px rgba(244,161,27,0.4)',
      },
      screens: {
        'xs': '375px',
      },
      maxWidth: {
        'mobile': '430px',
      },
    },
  },
  plugins: [],
}
