/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        admin: {
          frame: "#160078",
          surface: "#f5f2ff",
          card: "#ffffff",
          ink: "#101321",
          muted: "#5f6880",
          border: "#d7dded",
          brand: "#7226ff",
          accent: "#f042ff",
          deep: "#010030",
          purple: "#160078",
          logo: "#eaf5ff",
          track: "#ececf7",
          sidebar: "#f8f6ff",
        },
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "system-ui", "sans-serif"],
        display: ["Fraunces", "Georgia", "serif"],
      },
      boxShadow: {
        admin: "0 24px 60px rgba(16, 19, 33, 0.25)",
      },
    },
  },
  plugins: [],
};
