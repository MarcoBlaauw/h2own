/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{svelte,ts,js}'],
  theme: {
    extend: {
      // optional brand tokens
      colors: {
        brand: {
          50:  '#eff6ff',
          500: '#0ea5e9',
          600: '#0284c7'
        }
      }
    }
  },
  plugins: []
};
