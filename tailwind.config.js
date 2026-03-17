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
            }
        },
    },
    plugins: [],
}
