/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        admin: {
          frame: "#134611",
          surface: "#e8fccf",
          card: "#ffffff",
          ink: "#134611",
          muted: "#5f7a5f",
          border: "#b7d7a8",
          brand: "#3e8914",
          accent: "#3da35d",
          deep: "#0d2f0d",
          purple: "#134611",
          logo: "#dff3ca",
          track: "#d5edb9",
          sidebar: "#f4faea",
        },
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "system-ui", "sans-serif"],
        display: ["Fraunces", "Georgia", "serif"],
      },
      boxShadow: {
        admin: "0 24px 60px rgba(19, 70, 17, 0.22)",
      },
    },
  },
  plugins: [],
};
