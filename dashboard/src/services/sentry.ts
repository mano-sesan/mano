import * as Sentry from "@sentry/react";
import { ScopeContext } from "@sentry/types";

// Extend ScopeContext to make all properties optional
interface OptionalScopeContext extends Partial<ScopeContext> {}

export const capture = (err: Error, context: OptionalScopeContext = {}): void => {
  if (process.env.NODE_ENV === "development") console.log("capture", err, context);

  if (!context) {
    Sentry.captureException(err);
    return;
  }

  try {
    context = JSON.parse(JSON.stringify(context)); // deep copy context
  } catch (e) {
    console.error("Error parsing context", e);
    return;
  }

  // @ts-expect-error Property 'status' does not exist on type 'unknown'
  if (context?.extra?.response?.status === 401) return;

  if (context.extra) {
    const newExtra: Record<string, string> = {};
    for (const extraKey of Object.keys(context.extra)) {
      newExtra[extraKey] =
        typeof context.extra[extraKey] === "string" ? (context.extra[extraKey] as string) : JSON.stringify(context.extra[extraKey]);
    }
    context.extra = newExtra;
  }

  if (Sentry && err) {
    if (typeof err === "string") {
      Sentry.captureMessage(err, context);
    } else {
      Sentry.captureException(err, context);
    }
  } else {
    console.log("capture", err, JSON.stringify(context));
  }
};

export const AppSentry = Sentry;
