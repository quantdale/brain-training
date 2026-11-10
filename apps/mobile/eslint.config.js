// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", ".expo/*"],
  },
  {
    // Jest global setup runs inside the Jest runtime, where the test framework
    // injects its lifecycle globals. Declaring only `jest` left `afterEach`
    // undefined, which `npx eslint .` reported as an error while `expo lint`
    // (src/app/components only) never saw it.
    files: ["jest/**/*.js"],
    languageOptions: {
      globals: {
        jest: "readonly",
        afterAll: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        beforeEach: "readonly",
        describe: "readonly",
        expect: "readonly",
        it: "readonly",
        test: "readonly",
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
