import * as Sentry from "@sentry/remix";

/**
 * Sentry Error Monitoring Configuration
 *
 * Initialize Sentry for server-side error tracking.
 * Set SENTRY_DSN environment variable to enable.
 */

const SENTRY_DSN = process.env.SENTRY_DSN;

export function initSentry() {
  if (!SENTRY_DSN) {
    console.log("[Sentry] DSN not configured, error monitoring disabled");
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",

    // Performance monitoring
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    // Filter out noisy errors
    ignoreErrors: [
      // Network errors that are expected
      "ECONNREFUSED",
      "ETIMEDOUT",
      "ENOTFOUND",
      // Shopify rate limiting
      "Throttled",
      "Too Many Requests",
    ],

    // Capture unhandled promise rejections
    integrations: [
      Sentry.captureConsoleIntegration({
        levels: ["error"],
      }),
    ],

    // Sanitize sensitive data
    beforeSend(event) {
      // Remove sensitive headers
      if (event.request?.headers) {
        delete event.request.headers["authorization"];
        delete event.request.headers["x-shopify-access-token"];
        delete event.request.headers["cookie"];
      }

      // Remove sensitive data from breadcrumbs
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => {
          if (breadcrumb.data?.accessToken) {
            breadcrumb.data.accessToken = "[REDACTED]";
          }
          return breadcrumb;
        });
      }

      return event;
    },
  });

  console.log("[Sentry] Error monitoring initialized");
}

/**
 * Capture an error with additional context
 */
export function captureError(
  error: Error,
  context?: {
    shopDomain?: string;
    jobId?: string;
    productId?: string;
    action?: string;
  }
) {
  if (!SENTRY_DSN) {
    console.error("[Error]", error.message, context);
    return;
  }

  Sentry.withScope((scope) => {
    if (context?.shopDomain) {
      scope.setTag("shop", context.shopDomain);
    }
    if (context?.jobId) {
      scope.setTag("jobId", context.jobId);
    }
    if (context?.productId) {
      scope.setTag("productId", context.productId);
    }
    if (context?.action) {
      scope.setTag("action", context.action);
    }

    Sentry.captureException(error);
  });
}

/**
 * Set user context for error tracking
 */
export function setUserContext(shopDomain: string, plan?: string) {
  if (!SENTRY_DSN) return;

  Sentry.setUser({
    id: shopDomain,
    username: shopDomain,
  });

  if (plan) {
    Sentry.setTag("plan", plan);
  }
}

/**
 * Add breadcrumb for tracking user actions
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, unknown>
) {
  if (!SENTRY_DSN) return;

  Sentry.addBreadcrumb({
    message,
    category,
    level: "info",
    data,
  });
}

/**
 * Wrap async function with error capture
 */
export function withErrorCapture<T>(
  fn: () => Promise<T>,
  context?: Parameters<typeof captureError>[1]
): Promise<T> {
  return fn().catch((error) => {
    captureError(error, context);
    throw error;
  });
}

// Re-export Sentry for direct usage
export { Sentry };
