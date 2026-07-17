import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/data/**", "**/test-results/**", "**/playwright-report/**", "**/*.tsbuildinfo"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Codebase convention: prefix an intentionally-unused destructured
    // binding with `_` (e.g. omitting a key via `const { id: _id, ...rest }`).
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["packages/shared/**/*.ts", "packages/server/**/*.ts"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["packages/web/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { react, "react-hooks": reactHooks },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
    },
    settings: { react: { version: "detect" } },
  },
);
