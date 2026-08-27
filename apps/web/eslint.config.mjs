import { defineConfig, globalIgnores } from "eslint/config";
import nextPlugin from "@next/eslint-plugin-next";
import react from "@eslint-react/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import importX from "eslint-plugin-import-x";
import tseslint from "typescript-eslint";

// ESLint 10 stack (P6, 2026-08-27). eslint-config-next 16 still pins
// eslint-plugin-react / jsx-a11y / import to ESLint 9 (vercel/next.js#91702),
// so its four pieces are composed directly here with the same rule intent:
//   core-web-vitals  → @next/eslint-plugin-next recommended + core-web-vitals
//   react recommended → @eslint-react recommended (React 19-aware)
//   react-hooks       → eslint-plugin-react-hooks recommended
//   a11y subset       → the six jsx-a11y rules eslint-config-next enabled (warn)
//   import            → import-x/no-anonymous-default-export (warn)
//   typescript        → typescript-eslint recommended, with the two rules
//                       eslint-config-next/typescript downgraded to warn.
const eslintConfig = defineConfig([
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"],
    plugins: {
      "@next/next": nextPlugin,
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
      "import-x": importX,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      ...reactHooks.configs.recommended.rules,
      "react-hooks/set-state-in-effect": "off",
      "jsx-a11y/alt-text": ["warn", { elements: ["img"], img: ["Image"] }],
      "jsx-a11y/aria-props": "warn",
      "jsx-a11y/aria-proptypes": "warn",
      "jsx-a11y/aria-unsupported-elements": "warn",
      "jsx-a11y/role-has-required-aria-props": "warn",
      "jsx-a11y/role-supports-aria-props": "warn",
      "import-x/no-anonymous-default-export": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-unused-expressions": "warn",
    },
  },
  {
    files: ["**/*.{jsx,tsx}"],
    ...react.configs.recommended,
    rules: {
      ...react.configs.recommended.rules,
      // Two @eslint-react rules duplicate react-hooks rules already configured
      // above; everything else in the recommended set is enforced (P6, 08-27).
      "@eslint-react/set-state-in-effect": "off", // mirrors react-hooks/set-state-in-effect off above
      "@eslint-react/exhaustive-deps": "off", // duplicate of react-hooks/exhaustive-deps (kept)
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
