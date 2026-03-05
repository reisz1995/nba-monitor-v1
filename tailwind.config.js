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
            },
        },
    },
    plugins: [],
}
