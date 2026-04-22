/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['var(--font-inter)', 'sans-serif'],
        display: ['var(--font-manrope)', 'sans-serif'],
        headline:['var(--font-manrope)', 'sans-serif'],
      },
      colors: {
        // ── Design-token aliases (CSS vars) ────────────────────────────────
        surface:    'var(--surface)',
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        // ── Brand colours (shared – override in dark via .dark) ────────────
        primary:    '#0052d0',
        'primary-dk':'#638eff',
        secondary:  '#00675e',
        'secondary-dk':'#7ae7d8',
        tertiary:   '#8d3a8b',
        'tertiary-dk':'#e88ae1',
        // ── Semantic surfaces ──────────────────────────────────────────────
        'surface-container':         'var(--surface-container)',
        'surface-container-low':     'var(--surface-container-low)',
        'surface-container-lowest':  'var(--surface-container-lowest)',
        'surface-container-high':    'var(--surface-container-high)',
        'surface-container-highest': 'var(--surface-container-highest)',
        'surface-dim':               'var(--surface-dim)',
        'on-surface':                'var(--on-surface)',
        'on-surface-variant':        'var(--on-surface-variant)',
        'outline':                   'var(--outline)',
        'outline-variant':           'var(--outline-variant)',
      },
      animation: {
        springUp: 'springUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        fadeIn:   'fadeIn 0.35s ease-out forwards',
        blob:     'blob 12s infinite ease-in-out',
      },
      keyframes: {
        springUp: {
          '0%':   { opacity: '0', transform: 'scale(0.88) translateY(20px)' },
          '60%':  { opacity: '1', transform: 'scale(1.02) translateY(-3px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        blob: {
          '0%,100%': { transform: 'translate(0,0) scale(1)' },
          '33%':     { transform: 'translate(30px,-50px) scale(1.1)' },
          '66%':     { transform: 'translate(-20px,20px) scale(0.9)' },
        },
      },
    },
  },
  plugins: [],
};
