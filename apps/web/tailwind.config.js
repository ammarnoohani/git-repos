/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Google Sans',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      colors: {
        google: {
          blue: '#1a73e8',
          red: '#ea4335',
          yellow: '#fbbc04',
          green: '#34a853',
          gray: '#5f6368',
          border: '#dadce0',
          hover: '#f8f9fa',
          darkBg: '#202124',
          darkSurface: '#303134',
          darkBorder: '#3c4043',
          darkText: '#e8eaed',
          darkSubtext: '#9aa0a6',
        },
      },
    },
  },
  plugins: [],
};

