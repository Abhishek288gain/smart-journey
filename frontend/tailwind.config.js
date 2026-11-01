export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          500: '#0284c7',
          600: '#0369a1',
          700: '#075985',
        },
        navy: {
          900: '#071126',
          800: '#0d1935',
          700: '#152449',
        },
        tealAccent: '#00d4a8',
      },
    },
  },
  plugins: [],
}
