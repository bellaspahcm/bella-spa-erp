import * as Sentry from "@sentry/nextjs";
import { sentryBeforeSend } from "@/lib/log-redactor";

// Only initialize Sentry when DSN is configured
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    debug: false,
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    beforeSend(event) {
      return sentryBeforeSend(event);
    },
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.data) {
        const { redact } = require("@/lib/log-redactor");
        breadcrumb.data = redact(breadcrumb.data);
      }
      return breadcrumb;
    },
  });
}
