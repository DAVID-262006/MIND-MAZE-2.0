import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        arena: {
          bg: '#080B13',
          card: '#0F1626',
          panel: '#151F34',
          border: '#1E2D4A',
          hover: '#253759',
          muted: '#8A99B5',
        },
        electric: {
          cyan: '#00F2FE',
          emerald: '#10B981',
          amber: '#F59E0B',
          crimson: '#EF4444',
          violet: '#8B5CF6',
          blue: '#3B82F6',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow-cyan': 'glowCyan 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glowCyan: {
          '0%': { boxShadow: '0 0 5px rgba(0, 242, 254, 0.2)' },
          '100%': { boxShadow: '0 0 20px rgba(0, 242, 254, 0.6)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;

