module.exports = {
  root: true,
  extends: ["@react-native", "prettier"],
  globals: {
    fetch: false,
    Headers: false,
  },
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
  },
};
