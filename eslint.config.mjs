import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Test files are excluded from strict any rule — mocks legitimately use any
    "src/__tests__/**",
  ]),
  // Track as-any debt in production code.
  // Phase 1.1.5: warn (baseline ~100 files). Promote to error in Phase 1.3 after file splits.
  // Run `npm run lint:strict` for a hard failure audit at any time.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/__tests__/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
]);

export default eslintConfig;
