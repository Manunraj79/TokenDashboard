/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17202a",
        paper: "#f5f3ee",
        coral: "#d66a4a",
      },
      boxShadow: {
        card: "0 16px 40px -24px rgba(23, 32, 42, 0.35)",
      },
    },
  },
  plugins: [],
};
