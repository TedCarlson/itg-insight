"use client";

import type { ReactNode } from "react";

type Option<T extends string> = {
  value: T;
  label: ReactNode;
};

function cls(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/**
 * SegmentedControl (Tabs-lite)
 * - Controlled component: value + onChange.
 *
 * Goal:
 * - Respect theme active background (your "green" selected state)
 * - Ensure active text is always readable (default: white ink)
 * - Add a visible selected border
 * - Add focus-visible ring for keyboard navigation
 *
 * Theme hooks:
 * - --to-toggle-active-bg (or --to-seg-active-bg)
 * - --to-toggle-active-ink (or --to-seg-active-ink)
 * - --to-toggle-active-border (or --to-seg-active-border)
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className,
  size = "md",
}: {
  value: T;
  onChange: (next: T) => void;
  options: Array<Option<T>>;
  className?: string;
  size?: "sm" | "md";
}) {
  const wrap = size === "sm" ? "p-0.5" : "p-1";
  const btn = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1.5 text-sm";

  return (
    <div
      className={cls("inline-flex rounded-full border", wrap, className)}
      style={{
        borderColor: "var(--to-border)",
        background: "var(--to-surface)",
      }}
      role="tablist"
      aria-label="Segmented control"
    >
      {options.map((opt) => {
        const active = opt.value === value;

        const activeBg =
          "var(--to-toggle-active-bg, var(--to-seg-active-bg, var(--to-row-hover)))";
        // Key change: default to WHITE so green stays readable without extra theme work.
        const activeInk =
          "var(--to-toggle-active-ink, var(--to-seg-active-ink, white))";
        const activeBorder =
          "var(--to-toggle-active-border, var(--to-seg-active-border, rgba(0,0,0,0.12)))";

        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cls(
              "rounded-full font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--to-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--to-surface)]",
              btn,
              active
                ? "text-green-900"
                : "text-[var(--to-ink-muted)] hover:text-[var(--to-ink)] hover:bg-[var(--to-bg-subtle)]"
            )}
            style={{
              background: active ? activeBg : "transparent",
              color: active ? activeInk : undefined,
              // Requested: clear selected border (works on light or green fills)
              boxShadow: active ? `inset 0 0 0 2px ${activeBorder}` : undefined,
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}