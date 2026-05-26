import * as Sentry from "@sentry/nextjs";
import { sentryBeforeSend, redact } from "@/lib/log-redactor";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    debug: false,
    beforeSend(event) {
      return sentryBeforeSend(event);
    },
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.data) {
        breadcrumb.data = redact(breadcrumb.data);
      }
      return breadcrumb;
    },
  });
}
