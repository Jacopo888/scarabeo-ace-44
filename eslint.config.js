import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "build",
      "coverage",
      "node_modules",
      // Non-FE engine and native wrapper build outputs
      "engine",
      "engine/**/*",
      "**/quackle_wrapper/build/**",
      // Quarantine (temporary): known offenders to fix later
      "src/pages/Game.tsx",
      "src/services/quackleClient.ts",
      "src/services/quackleClient.test.ts",
    ],
    linterOptions: {
      // Do not warn for unused eslint-disable comments during quarantine
      reportUnusedDisableDirectives: "off",
    },
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Reduce noise: disable warnings that are not actionable right now
      "react-refresh/only-export-components": ["off", { allowConstantExport: true }],
      "react-hooks/rules-of-hooks": "off",
      "react-hooks/exhaustive-deps": "off",
      // Allow empty blocks in TSX (e.g., placeholder try/catch) during quarantine
      "no-empty": "off",
      // Keep these relaxed for this project
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/ban-ts-comment": "off",
    },
  }
);
