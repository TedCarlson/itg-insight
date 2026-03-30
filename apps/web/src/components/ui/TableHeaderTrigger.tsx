"use client";

type Props = {
  label: string;
  onClick?: () => void;
  showIcon?: boolean;
  align?: "center" | "left" | "right";
};

export default function TableHeaderTrigger({
  label,
  onClick,
  showIcon = true,
  align = "center",
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "group flex items-center gap-1.5 uppercase tracking-wide",
        "text-[11px] font-semibold text-muted-foreground",
        "transition-colors",
        align === "center" ? "mx-auto justify-center" : "",
        align === "left" ? "justify-start" : "",
        align === "right" ? "justify-end ml-auto" : "",
      ].join(" ")}
    >
      <span>{label}</span>

      {showIcon && (
        <span
          className={[
            "flex h-4 w-4 items-center justify-center rounded-full border",
            "text-[9px] leading-none",
            "text-muted-foreground",
            "transition-all",
            "group-hover:text-foreground group-hover:border-foreground/40",
          ].join(" ")}
        >
          i
        </span>
      )}
    </button>
  );
}