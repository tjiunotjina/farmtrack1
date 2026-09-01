/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        parchment: '#EDE7D8',
        border: '#D9D2BF',
        ink: '#2A2B22',
        muted: '#8A8570',
        forest: '#4A5D3A',
        leather: '#9C5A34',
        leatherText: '#7A3D22',
        teal: '#4C7A82',
        ochre: '#C08A2E',
        rust: '#9C3B2E',
      },
      fontFamily: {
        serif: ['Zilla Slab', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
      borderRadius: { xl2: '32px' },
    },
  },
  plugins: [],
};
