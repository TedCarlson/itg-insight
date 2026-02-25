// RUN THIS
// Replace the entire file:
// apps/web/src/components/ui/DataTable.tsx

"use client";

import React, { createContext, useContext, useMemo } from "react";
import type { CSSProperties, HTMLAttributes, PropsWithChildren } from "react";

type Layout = "content" | "full" | "fixed";

type Ctx = {
  gridClassName?: string;
  gridStyle?: CSSProperties;
  zebra?: boolean;
  hover?: boolean;
  layout?: Layout;
};

const DataTableCtx = createContext<Ctx>({});

function cls(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function mergeStyle(a?: CSSProperties, b?: CSSProperties): CSSProperties | undefined {
  if (!a && !b) return undefined;
  return { ...(a ?? {}), ...(b ?? {}) };
}

export type DataTableProps = PropsWithChildren<{
  zebra?: boolean;
  hover?: boolean;
  layout?: Layout;

  gridClassName?: string;
  gridStyle?: CSSProperties;

  className?: string;
}>;

export function DataTable(props: DataTableProps) {
  const { children, zebra, hover, layout = "content", gridClassName, gridStyle, className } = props;

  const ctx = useMemo<Ctx>(
    () => ({ zebra, hover, layout, gridClassName, gridStyle }),
    [zebra, hover, layout, gridClassName, gridStyle]
  );

  return (
    <DataTableCtx.Provider value={ctx}>
      <div className={cls("w-full", layout === "full" && "h-full", className)}>{children}</div>
    </DataTableCtx.Provider>
  );
}

export type DataTableHeaderProps = PropsWithChildren<{
  className?: string;
  gridClassName?: string;
  gridStyle?: CSSProperties;
}>;

export function DataTableHeader(props: DataTableHeaderProps) {
  const { className, children, gridClassName, gridStyle } = props;
  const ctx = useContext(DataTableCtx);

  return (
    <div
      className={cls(
        "grid items-center gap-0 border-b bg-[var(--to-surface-2)] text-sm font-medium",
        ctx.gridClassName,
        gridClassName,
        className
      )}
      style={mergeStyle(ctx.gridStyle, gridStyle)}
    >
      {children}
    </div>
  );
}

export type DataTableBodyProps = PropsWithChildren<{
  className?: string;
  gridClassName?: string;
  gridStyle?: CSSProperties;

  // Back-compat: callers sometimes set zebra on the Body
  zebra?: boolean;
}>;

export function DataTableBody(props: DataTableBodyProps) {
  const { className, children, gridClassName, gridStyle, zebra } = props;
  const ctx = useContext(DataTableCtx);

  const useZebra = zebra ?? ctx.zebra ?? false;

  return (
    <div
      className={cls(
        "grid gap-0",
        // Zebra striping for DataTableRow children (works for grid/div rows)
        useZebra && "[&>*:nth-child(even)]:bg-[var(--to-surface-soft)] [&>*:nth-child(odd)]:bg-[var(--to-surface)]",
        ctx.gridClassName,
        gridClassName,
        className
      )}
      style={mergeStyle(ctx.gridStyle, gridStyle)}
    >
      {children}
    </div>
  );
}

export type DataTableRowProps = HTMLAttributes<HTMLDivElement> & {
  className?: string;

  hover?: boolean;
  gridClassName?: string;
  gridStyle?: CSSProperties;
};

export function DataTableRow(props: DataTableRowProps) {
  const { className, children, hover, gridClassName, gridStyle, ...rest } = props;
  const ctx = useContext(DataTableCtx);

  const useHover = hover ?? ctx.hover ?? false;

  return (
    <div
      className={cls(
        "grid items-center gap-0 border-b text-sm outline-none",
        ctx.gridClassName,
        gridClassName,
        useHover && "hover:bg-[var(--to-surface-2)]",
        className
      )}
      style={mergeStyle(ctx.gridStyle, gridStyle)}
      {...rest}
    >
      {children}
    </div>
  );
}

export type DataTableFooterProps = PropsWithChildren<{
  className?: string;
  gridClassName?: string;
  gridStyle?: CSSProperties;
}>;

export function DataTableFooter(props: DataTableFooterProps) {
  const { className, children, gridClassName, gridStyle } = props;
  const ctx = useContext(DataTableCtx);

  return (
    <div
      className={cls(
        "grid items-center gap-0 border-t bg-[var(--to-surface-2)] text-sm",
        ctx.gridClassName,
        gridClassName,
        className
      )}
      style={mergeStyle(ctx.gridStyle, gridStyle)}
    >
      {children}
    </div>
  );
}

export default DataTable;