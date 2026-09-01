import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        navy: 'var(--navy)',
        'navy-light': 'var(--navy-light)',
        gold: 'var(--gold)',
        ink: 'var(--ink)',
        success: 'var(--success)',
        warn: 'var(--warn)',
        danger: 'var(--danger)',
        border: 'var(--border)',
        muted: 'var(--text-muted)',
        bg: 'var(--bg)',
      },
      fontFamily: {
        display: ['"IBM Plex Serif"', 'serif'],
        sans: ['"IBM Plex Sans"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
export default config;
