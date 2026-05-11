// path: apps/web/src/features/admin/access-health/lib/accessHealthUtils.ts

export function clean(value: unknown): string | null {
  const next = String(value ?? "").trim();
  return next || null;
}

export function bool(value: unknown): boolean {
  return value === true;
}

export function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}