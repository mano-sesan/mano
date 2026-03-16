/** @type {import('tailwindcss').Config} */

export default {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  safelist: ["tw-min-w-0"],
  theme: {
    extend: {
      gridTemplateColumns: {
        "new-report-squares": "repeat(auto-fit, minmax(40%, 1fr))",
      },
      colors: {
        main: "#226854", // higher contrast
        main75: "#617e71",
        main50: "#95a9a0",
        main25: "#cad4cf",
        "mano-sombre": "#374B43",
        black: "#1D2021",
        black75: "#3b3b3b",
        black50: "#777777",
        black25: "#b9b9b9",
        black05: "#F7F9FA",
        white: "#FFFFFF",
        redDark: "#F5222D",
        redLight: "#FBE4E4",
        orangeLight: "#FEF3C7",
        orangeDark: "#D97706",
      },
      borderColor: (theme) => ({
        DEFAULT: theme("colors.black"),
        dark: {
          DEFAULT: theme("colors.white"),
        },
      }),
      minHeight: {
        "1/2": "50vh",
      },
    },
  },
  plugins: [
    require("@tailwindcss/forms")({
      // strategy: 'base', // only generate global styles
      /* When using the class strategy, form elements are not styled globally,
       and instead must be styled using the generated form-{name} classes. */
      strategy: "class", // only generate classes
    }),
  ],
  prefix: "tw-",
};
