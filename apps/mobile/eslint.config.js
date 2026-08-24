// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // Jest global setup runs inside the Jest runtime where `jest` is injected.
    files: ["jest/**/*.js"],
    languageOptions: {
      globals: {
        jest: "readonly",
      },
    },
  },
  {
    // Node scripts execute under Node, not the RN bundler.
    files: ["scripts/**/*.mjs", "scripts/**/*.js", "plugins/**/*.js"],
    languageOptions: {
      globals: {
        Buffer: "readonly",
        console: "readonly",
        process: "readonly",
      },
    },
  },
]);
