// lib/logger.ts
// Structured server-side error logging — no external account required to
// start. Every host on TESTING_READINESS.md's shortlist (Render, Railway,
// Fly.io, a VM under systemd/pm2) captures stdout/stderr into a viewable log
// stream automatically, so this is genuinely enough to know something broke
// for a real realtor without setting up Sentry first. One JSON line per
// error keeps it greppable/filterable in whatever log viewer the host gives
// you. Swap in a real error-tracking service later by replacing this one
// function's body — every call site stays the same.

interface LogContext {
  route: string;
  userId?: string;
  dealId?: string;
  [key: string]: unknown;
}

export function logError(context: LogContext, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  console.error(
    JSON.stringify({
      level: "error",
      timestamp: new Date().toISOString(),
      message,
      stack,
      ...context,
    })
  );
}
