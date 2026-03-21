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
import type {
  FieldLogCategory,
  FieldLogRuntimeBootstrap,
  FieldLogRule,
  FieldLogSubcategory,
  FieldLogUcode,
} from "../lib/fieldLog.types";

type RuntimeContextValue = {
  loading: boolean;
  error: string | null;
  config: FieldLogRuntimeBootstrap["config"];
  categories: FieldLogCategory[];
  subcategories: FieldLogSubcategory[];
  rules: FieldLogRule[];
  ucodes: FieldLogUcode[];
  refresh: () => Promise<void>;
  getSubcategoriesForCategory: (
    categoryKey: string | null | undefined,
  ) => FieldLogSubcategory[];
  getRuleForSelection: (
    categoryKey: string | null | undefined,
    subcategoryKey: string | null | undefined,
  ) => FieldLogRule | null;
};

type BootstrapResponse = {
  ok?: boolean;
  data?: Partial<FieldLogRuntimeBootstrap> & {
    ucodes?: FieldLogUcode[];
  };
  error?: string;
};

const FieldLogRuntimeContext = createContext<RuntimeContextValue | null>(null);

function asCategories(value: unknown): FieldLogCategory[] {
  return Array.isArray(value) ? (value as FieldLogCategory[]) : [];
}

function asSubcategories(value: unknown): FieldLogSubcategory[] {
  return Array.isArray(value) ? (value as FieldLogSubcategory[]) : [];
}

function asRules(value: unknown): FieldLogRule[] {
  return Array.isArray(value) ? (value as FieldLogRule[]) : [];
}

function asUcodes(value: unknown): FieldLogUcode[] {
  return Array.isArray(value) ? (value as FieldLogUcode[]) : [];
}

function normalizeRuntime(
  data: (Partial<FieldLogRuntimeBootstrap> & { ucodes?: FieldLogUcode[] }) | null | undefined,
): FieldLogRuntimeBootstrap {
  return {
    config: data?.config ?? null,
    categories: asCategories(data?.categories),
    subcategories: asSubcategories(data?.subcategories),
    rules: asRules(data?.rules),
    ucodes: asUcodes(data?.ucodes),
  };
}

export function FieldLogRuntimeProvider(props: { children: ReactNode }) {
  const { children } = props;

  const [runtime, setRuntime] = useState<FieldLogRuntimeBootstrap>({
    config: null,
    categories: [],
    subcategories: [],
    rules: [],
    ucodes: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/field-log/bootstrap", {
        method: "GET",
        cache: "no-store",
      });

      const json = (await res.json()) as BootstrapResponse;

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to load Field Log runtime.");
      }

      setRuntime(normalizeRuntime(json.data));
    } catch (err) {
      setRuntime({
        config: null,
        categories: [],
        subcategories: [],
        rules: [],
        ucodes: [],
      });
      setError(err instanceof Error ? err.message : "Failed to load Field Log runtime.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<RuntimeContextValue>(() => {
    function getSubcategoriesForCategory(categoryKey: string | null | undefined) {
      if (!categoryKey) return [];
      return runtime.subcategories.filter((item) => item.category_key === categoryKey);
    }

    function getRuleForSelection(
      categoryKey: string | null | undefined,
      subcategoryKey: string | null | undefined,
    ) {
      if (!categoryKey) return null;

      return (
        runtime.rules.find(
          (rule) =>
            rule.category_key === categoryKey &&
            (rule.subcategory_key ?? null) === (subcategoryKey ?? null),
        ) ?? null
      );
    }

    return {
      loading,
      error,
      config: runtime.config,
      categories: runtime.categories,
      subcategories: runtime.subcategories,
      rules: runtime.rules,
      ucodes: runtime.ucodes,
      refresh,
      getSubcategoriesForCategory,
      getRuleForSelection,
    };
  }, [runtime, loading, error, refresh]);

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