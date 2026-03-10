import type {
  FieldLogCategory,
  FieldLogRule,
  FieldLogRuntimeBootstrap,
  FieldLogSubcategory,
} from "./fieldLog.types";

export function getCategoryRules(
  runtime: FieldLogRuntimeBootstrap | null,
  categoryKey: string | null | undefined,
) {
  if (!runtime || !categoryKey) return [];
  return runtime.rules.filter((rule) => rule.category_key === categoryKey);
}

export function getSubcategoriesForCategory(
  runtime: FieldLogRuntimeBootstrap | null,
  categoryKey: string | null | undefined,
): FieldLogSubcategory[] {
  if (!runtime || !categoryKey) return [];
  return runtime.subcategories
    .filter((item) => item.category_key === categoryKey)
    .sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label));
}

export function getRuleForSelection(
  runtime: FieldLogRuntimeBootstrap | null,
  categoryKey: string | null | undefined,
  subcategoryKey: string | null | undefined,
): FieldLogRule | null {
  if (!runtime || !categoryKey) return null;

  return (
    runtime.rules.find(
      (rule) =>
        rule.category_key === categoryKey &&
        (rule.subcategory_key ?? null) === (subcategoryKey ?? null),
    ) ?? null
  );
}

export function categoryRequiresSubcategory(
  runtime: FieldLogRuntimeBootstrap | null,
  categoryKey: string | null | undefined,
) {
  if (!runtime || !categoryKey) return false;
  return runtime.rules.some(
    (rule) => rule.category_key === categoryKey && rule.require_subcategory,
  );
}

export function getCategoryByKey(
  runtime: FieldLogRuntimeBootstrap | null,
  categoryKey: string | null | undefined,
): FieldLogCategory | null {
  if (!runtime || !categoryKey) return null;
  return runtime.categories.find((item) => item.category_key === categoryKey) ?? null;
}