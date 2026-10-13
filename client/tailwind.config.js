/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // These read CSS variables (see index.css) so Light / Dark / Custom themes can change them.
        brand: Object.fromEntries([50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((n) => [n, v(`--brand-${n}`)])),
        cream: v('--cream'),
        surface: v('--surface'),
        ink: { DEFAULT: v('--ink'), soft: v('--ink-soft'), mute: v('--ink-mute') },
        night: '#201915', // always-dark bars (header, drawer): they do not flip in dark mode
        snow: '#fff9f2',
        saffron: '#f5b73c',
        leaf: '#2f9e5b',
      },
      fontFamily: {
        sans: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
      },
      keyframes: {
        shine: { '0%': { transform: 'translateX(-120%) skewX(-20deg)' }, '60%,100%': { transform: 'translateX(320%) skewX(-20deg)' } },
        bob: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
        marquee: { '0%': { transform: 'translateX(0)' }, '100%': { transform: 'translateX(-50%)' } },
        gradient: { '0%,100%': { backgroundPosition: '0% 50%' }, '50%': { backgroundPosition: '100% 50%' } },
        floaty: { '0%': { transform: 'translateY(0) rotate(0deg)', opacity: '0' }, '15%': { opacity: '.5' }, '100%': { transform: 'translateY(-110vh) rotate(25deg)', opacity: '0' } },
      },
      animation: { shine: 'shine 2.8s ease-in-out infinite', bob: 'bob 3s ease-in-out infinite', marquee: 'marquee 30s linear infinite', gradient: 'gradient 16s ease infinite', floaty: 'floaty 14s linear infinite' },
      boxShadow: { card: '0 1px 2px rgba(32,25,21,.05), 0 8px 24px -12px rgba(32,25,21,.18)' },
    },
  },
  plugins: [],
};
