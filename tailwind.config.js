/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./{components,hooks,lib,services,pages}/**/*.{js,ts,jsx,tsx}",
        "./App.tsx",
        "./index.tsx",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                mono: ['Space Mono', 'monospace'],
                oswald: ['Oswald', 'sans-serif'],
                bebas: ['"Bebas Neue"', 'sans-serif'],
            },
            colors: {
                nba: {
                    blue: '#1D428A',
                    red: '#C8102E',
                    gold: '#FFD700',
                    black: '#0A0A0A',
                    surface: '#141414',
                    'surface-elevated': '#1E1E1E'
                }
            },
            boxShadow: {
                'nba-blue': '0 0 20px rgba(29, 66, 138, 0.5)',
                'nba-red': '0 0 20px rgba(200, 16, 46, 0.5)',
                'nba-gold': '0 0 30px rgba(255, 215, 0, 0.4)',
                'nba-white': '0 0 15px rgba(255, 255, 255, 0.3)',
            }
        },
    },
    plugins: [],
}
