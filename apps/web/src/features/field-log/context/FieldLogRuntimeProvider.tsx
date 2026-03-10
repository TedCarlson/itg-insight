"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { FieldLogRuntimeBootstrap, FieldLogRule } from "../lib/fieldLog.types";
import {
  categoryRequiresSubcategory,
  getCategoryByKey,
  getCategoryRules,
  getRuleForSelection,
  getSubcategoriesForCategory,
} from "../lib/fieldLogRuntime";

type FieldLogRuntimeContextValue = {
  runtime: FieldLogRuntimeBootstrap | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;

  categories: FieldLogRuntimeBootstrap["categories"];
  getCategoryByKey: (categoryKey: string | null | undefined) => ReturnType<typeof getCategoryByKey>;
  getSubcategoriesForCategory: (
    categoryKey: string | null | undefined,
  ) => FieldLogRuntimeBootstrap["subcategories"];
  getCategoryRules: (categoryKey: string | null | undefined) => FieldLogRule[];
  getRuleForSelection: (
    categoryKey: string | null | undefined,
    subcategoryKey: string | null | undefined,
  ) => FieldLogRule | null;
  categoryRequiresSubcategory: (categoryKey: string | null | undefined) => boolean;
};

const FieldLogRuntimeContext = createContext<FieldLogRuntimeContextValue | null>(null);

async function fetchRuntimeBootstrap(): Promise<FieldLogRuntimeBootstrap> {
  const res = await fetch("/api/field-log/bootstrap", {
    method: "GET",
    cache: "no-store",
  });

  const json = (await res.json()) as {
    ok?: boolean;
    data?: FieldLogRuntimeBootstrap;
    error?: string;
  };

  if (!res.ok || !json.ok || !json.data) {
    throw new Error(json.error || "Failed to load Field Log runtime.");
  }

  return json.data;
}

export function FieldLogRuntimeProvider(props: { children: ReactNode }) {
  const { children } = props;

  const [runtime, setRuntime] = useState<FieldLogRuntimeBootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchRuntimeBootstrap();
      setRuntime(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Field Log runtime.");
      setRuntime(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<FieldLogRuntimeContextValue>(
    () => ({
      runtime,
      loading,
      error,
      refresh,

      categories: runtime?.categories ?? [],
      getCategoryByKey: (categoryKey) => getCategoryByKey(runtime, categoryKey),
      getSubcategoriesForCategory: (categoryKey) =>
        getSubcategoriesForCategory(runtime, categoryKey),
      getCategoryRules: (categoryKey) => getCategoryRules(runtime, categoryKey),
      getRuleForSelection: (categoryKey, subcategoryKey) =>
        getRuleForSelection(runtime, categoryKey, subcategoryKey),
      categoryRequiresSubcategory: (categoryKey) =>
        categoryRequiresSubcategory(runtime, categoryKey),
    }),
    [runtime, loading, error, refresh],
  );

  return (
    <FieldLogRuntimeContext.Provider value={value}>
      {children}
    </FieldLogRuntimeContext.Provider>
  );
}

export function useFieldLogRuntime() {
  const ctx = useContext(FieldLogRuntimeContext);

  if (!ctx) {
    throw new Error("useFieldLogRuntime must be used within FieldLogRuntimeProvider.");
  }

  return ctx;
}