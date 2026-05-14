export function getMetaObject(meta: unknown): Record<string, unknown> {
  return meta && typeof meta === "object" && !Array.isArray(meta)
    ? (meta as Record<string, unknown>)
    : {};
}

export function stringOrNull(value: unknown) {
  const s = typeof value === "string" ? value.trim() : "";
  return s || null;
}