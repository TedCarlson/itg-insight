// apps/web/src/shared/lib/navigation/next.ts

// Where you want users to land when "next" is missing or invalid.
const FALLBACK = "/";

// Allowlist of valid destinations in *this* app.
// IMPORTANT: Keep this aligned with apps/web/middleware.ts (ALLOWED_NEXT_PREFIXES there).
const ALLOWED_NEXT_PREFIXES = [
  "/",
  "/home",
  "/admin",
  "/org",
  "/route-lock",
  "/metrics",
  "/access", // note: disallowed below (prevents loops), but kept for parity
  "/auth/set-password", // allow explicit internal jump used by callback wrapper
] as const;

// Disallow redirecting back into auth machinery / doors.
// (We allow /auth/set-password above explicitly.)
const DISALLOWED_EXACT = new Set<string>(["/auth/callback", "/auth/signout"]);
const DISALLOWED_PREFIXES = ["/login", "/auth", "/access"] as const;

function isAllowed(pathname: string) {
  return ALLOWED_NEXT_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function isDisallowed(pathname: string) {
  if (DISALLOWED_EXACT.has(pathname)) return true;
  return DISALLOWED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function normalizeNext(input: string | null): string {
  const raw = (input ?? FALLBACK).trim() || FALLBACK;

  // Must be an internal absolute path; block protocol-relative ("//...") too.
  if (!raw.startsWith("/") || raw.startsWith("//")) return FALLBACK;

  // Keep querystring, but strip hash (hash is not meaningful server-side and can cause weird loops)
  const [pathPlusQuery] = raw.split("#");
  const pathname = pathPlusQuery.split("?")[0];

  if (isDisallowed(pathname)) return FALLBACK;
  if (!isAllowed(pathname)) return FALLBACK;

  return pathPlusQuery;
}