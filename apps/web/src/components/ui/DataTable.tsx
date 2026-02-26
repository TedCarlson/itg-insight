// RUN THIS (Polish #1a)
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

function defaultGridClass(layout: Layout) {
  // fixed = typical "table" behavior (explicit columns expected by callers)
  // content = each child becomes its own column sized to max-content (chips/compact tables)
  // full = fills height, uses fixed grid unless overridden
  return layout === "content" ? "grid-flow-col auto-cols-max" : "grid-cols-12";
}

function gridWidthClass(layout: Layout) {
  // content tables often want to grow beyond viewport and scroll horizontally
  // fixed/full tables should occupy available width
  return layout === "content" ? "w-max min-w-full" : "w-full";
}

// Modern defaults (applied to *direct children* which are your "cells")
const CELL_BASE = "[&>*]:min-w-0 [&>*]:px-3 [&>*]:py-2.5";
const CELL_HEADER = "[&>*]:min-w-0 [&>*]:px-3 [&>*]:py-2";

export type DataTableProps = PropsWithChildren<{
  zebra?: boolean;
  hover?: boolean;
  layout?: Layout;

  gridClassName?: string;
  gridStyle?: CSSProperties;

  className?: string;
}>;

export function DataTable(props: DataTableProps) {
  const { children, zebra, hover, layout = "fixed", gridClassName, gridStyle, className } = props;

  const derivedGridClassName = gridClassName ?? defaultGridClass(layout);

  const ctx = useMemo<Ctx>(
    () => ({
      zebra,
      hover,
      layout,
      gridClassName: derivedGridClassName,
      gridStyle,
    }),
    [zebra, hover, layout, derivedGridClassName, gridStyle]
  );

  return (
    <DataTableCtx.Provider value={ctx}>
      <div className={cls("w-full min-h-0", layout === "full" && "h-full", className)}>
        {/* Scroll viewport: enables sticky header/footer relative to the table container */}
        <div className={cls("w-full min-h-0 overflow-auto", layout !== "full" && "max-h-[60vh]")}>{children}</div>
      </div>
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
  const layout = ctx.layout ?? "fixed";

  return (
    <div
      className={cls(
        "grid items-center gap-0 border-b",
        // Permanent fix: ensure sticky header is OPAQUE (no text bleeding through)
        "bg-[var(--to-surface)]",
        // Sticky header (relative to the DataTable scroll viewport)
        "sticky top-0 z-20",
        // Visual separation so it reads clean while scrolling
        "shadow-sm",
        "text-xs font-semibold tracking-wide text-[var(--to-text-2)]",
        CELL_HEADER,
        gridWidthClass(layout),
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

  // Back-compat: callers sometimes set zebra on the Body
  zebra?: boolean;
}>;

export function DataTableBody(props: DataTableBodyProps) {
  const { className, children, zebra } = props;
  const ctx = useContext(DataTableCtx);

  const useZebra = zebra ?? ctx.zebra ?? false;

  // IMPORTANT:
  // Body must STACK ROWS VERTICALLY.
  // Do NOT apply ctx.gridClassName/gridStyle here, or rows will "flow into columns" and explode.
  return (
    <div
      className={cls(
        "flex flex-col",
        useZebra && "[&>*:nth-child(even)]:bg-[var(--to-surface-soft)] [&>*:nth-child(odd)]:bg-[var(--to-surface)]",
        className
      )}
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
  const layout = ctx.layout ?? "fixed";

  const useHover = hover ?? ctx.hover ?? false;

  return (
    <div
      className={cls(
        "grid items-center gap-0 border-b outline-none",
        "text-sm text-[var(--to-text)]",
        CELL_BASE,
        gridWidthClass(layout),
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
  const layout = ctx.layout ?? "fixed";

  return (
    <div
      className={cls(
        "grid items-center gap-0 border-t text-sm text-[var(--to-text)]",
        // Permanent fix: ensure sticky footer is OPAQUE too
        "bg-[var(--to-surface)]",
        // Sticky footer (relative to the DataTable scroll viewport)
        "sticky bottom-0 z-10",
        "shadow-sm",
        CELL_BASE,
        gridWidthClass(layout),
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