"use client";

import { useEffect, useRef } from "react";

type Props = {
  children: React.ReactNode;
  onClose: () => void;
  align?: "left" | "right" | "center";
  widthClass?: string;
};

export default function PopoverPanel({
  children,
  onClose,
  align = "center",
  widthClass = "w-56",
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    function onMouseDown(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) {
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onMouseDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, [onClose]);

  const alignClass =
    align === "right"
      ? "right-0"
      : align === "left"
      ? "left-0"
      : "left-1/2 -translate-x-1/2";

  return (
    <div
      ref={ref}
      className={[
        "absolute z-50 mt-2 rounded-xl border bg-background p-3 shadow-xl",
        widthClass,
        alignClass,
      ].join(" ")}
    >
      {children}
    </div>
  );
}