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
        studio: {
          bg: '#0B0F19',       // Deep space cinematic dark
          card: '#161D30',     // Slate card dark
          border: '#242F4D',   // Deep border dark
          primary: '#8B5CF6',  // Neon Purple
          secondary: '#06B6D4',// Cyan
          success: '#10B981',  // Emerald Green
          warning: '#F59E0B',  // Amber
          danger: '#EF4444',   // Rose Red
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'sans-serif'],
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
