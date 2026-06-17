import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Baseline of files that still contain `any` as of Phase 1.1.5 (2026-05-28).
// These are downgraded to `warn` so existing debt does not break CI, while every
// other file gets `error` — meaning any NEW `as any` in clean code fails the build.
// Shrink this list as files are cleaned (Sprint 1.3 file splits will remove many).
const ANY_DEBT_BASELINE = [
  "src/app/(auth)/signup/page.tsx",
  "src/app/api/cron/accounting-worker/route.ts",
  "src/app/api/cron/ai-autopilot/route.ts",
  "src/app/api/cron/zalo-reminders/route.ts",
  "src/app/api/test-upcoming/route.ts",
  "src/app/api/v1/ai/action-approval/route.ts",
  "src/app/api/v1/ai/coo-orchestrator/route.ts",
  "src/app/api/v1/ai/telegram-webhook/route.ts",
  "src/app/api/webhooks/payment/route.ts",
  "src/app/dashboard/accounting/chart-of-accounts/page.tsx",
  "src/app/dashboard/accounting/journals/\\[entryId\\]/page.tsx",
  "src/app/dashboard/accounting/journals/page.tsx",
  "src/app/dashboard/accounting/manual-entry/page.tsx",
  "src/app/dashboard/accounting/outbox/page.tsx",
  "src/app/dashboard/accounting/page.tsx",
  "src/app/dashboard/accounting/periods/page.tsx",
  "src/app/dashboard/accounting/reconciliation/page.tsx",
  "src/app/dashboard/accounting/reports/page.tsx",
  "src/app/dashboard/accounting/salary-reconciliation/page.tsx",
  "src/app/dashboard/ai-copilot/ai-copilot-client.tsx",
  "src/app/dashboard/bookings/page.tsx",
  "src/app/dashboard/chat/page.tsx",
  "src/app/dashboard/crm/page.tsx",
  "src/app/dashboard/customer/page.tsx",
  "src/app/dashboard/customers/\\[id\\]/page.tsx",
  "src/app/dashboard/customers/page.tsx",
  "src/app/dashboard/finance/page.tsx",
  "src/app/dashboard/finance/reconciliation/page.tsx",
  "src/app/dashboard/inventory/page.tsx",
  "src/app/dashboard/page.tsx",
  "src/app/dashboard/services/page.tsx",
  "src/app/dashboard/sessions/components/LeaveApprovalModal.tsx",
  "src/app/dashboard/sessions/components/SessionLogsDetailsModal.tsx",
  "src/app/dashboard/sessions/page.tsx",
  "src/app/dashboard/settings/PermissionsTab.tsx",
  "src/app/dashboard/settings/components/AccountingConfigTab.tsx",
  "src/app/dashboard/settings/components/HqBillingTab.tsx",
  "src/app/dashboard/settings/components/SubscriptionTab.tsx",
  "src/app/hq/financial-overview/page.tsx",
  "src/app/hq/hq-dashboard-client.tsx",
  "src/app/ktv/dashboard/page.tsx",
  "src/app/ktv/earnings/page.tsx",
  "src/app/ktv/leaderboard/page.tsx",
  "src/app/page.tsx",
  "src/app/portal/\\[token\\]/page.tsx",
  "src/components/common/PwaRegister.tsx",
  "src/components/features/BookingModal.tsx",
  "src/components/features/QuickAddCustomerModal.tsx",
  "src/components/features/TransactionModal.tsx",
  "src/components/features/landing/ServiceWizard.tsx",
  "src/components/features/portal/PortalChatWidget.tsx",
  "src/components/layout/sidebar.tsx",
  "src/hooks/useOfflineSync.ts",
  "src/lib/accounting-outbox.ts",
  "src/lib/log-redactor.ts",
  "src/lib/offline-db.ts",
  "src/lib/subscription.ts",
  "src/lib/utils.ts",
  "src/modules/booking/actions/commission-actions.ts",
  "src/modules/booking/actions/session-actions.ts",
  "src/services/accounting-actions.ts",
  "src/services/ai-coo-service.ts",
  "src/services/attendance-actions.ts",
  "src/services/audit-actions.ts",
  "src/services/brand-service-actions.ts",
  "src/services/chat-actions.ts",
  "src/services/clearing-actions.ts",
  "src/services/crm-actions.ts",
  "src/services/customer-actions.ts",
  "src/services/export-actions.ts",
  "src/services/franchise-actions.ts",
  "src/services/inventory-actions.ts",
  "src/services/inventory-transfer-actions.ts",
  "src/services/ktv-actions.ts",
  "src/services/package-actions.ts",
  "src/services/portal-chat-actions.ts",
  "src/services/reconciliation-actions.ts",
  "src/services/sync-actions.ts",
  "src/services/tenant-actions.ts",
  "src/types/domain.ts",
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "e2e/**",
    "mcp-server/**",
    "scripts/**",
    "scratch/**",
    "load-tests/**",
    "coverage/**",
    "playwright-report/**",
    ".tmp/**",
    "*.js",
    "*.mjs",
    "docs/**/*.js",
  ]),
  // Phase 1.1.5: no-explicit-any is an ERROR everywhere in production code.
  // A new `as any` in any clean file fails the build. `npm run lint:strict`
  // runs the same gate across the entire tree (including the baseline below).
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      // Allow unused vars prefixed with underscore (for interface compliance)
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          "argsIgnorePattern": "^_",
          "varsIgnorePattern": "^_",
          "caughtErrorsIgnorePattern": "^_"
        }
      ],
      // Data-fetch-on-mount screens intentionally set loading/result state from effects.
      // Keep exhaustive-deps on for stale-closure bugs; avoid noisy false positives here.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Existing debt: downgrade to warn so CI is not blocked retroactively.
  {
    files: ANY_DEBT_BASELINE,
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  // Test files and setup/config files legitimately use `any` for mocks and `require` for imports — exempt.
  {
    files: [
      "src/__tests__/**/*.{ts,tsx}",
      "jest.setup.ts",
      "instrumentation-client.ts",
      "instrumentation.ts",
      "sentry.edge.config.ts",
      "sentry.server.config.ts",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);

export default eslintConfig;
