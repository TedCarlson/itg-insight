"use client";

import { useEffect, useRef } from "react";

type Props = {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
};

export default function OverlayPanel({
  title,
  children,
  onClose,
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

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/35 p-4 pt-12">
      <div
        ref={ref}
        className="max-h-[85vh] w-full max-w-7xl overflow-auto rounded-2xl border bg-background shadow-2xl"
      >
        <div className="sticky top-0 flex items-center justify-between border-b bg-background px-4 py-3">
          <div className="text-sm font-semibold">{title}</div>

          <button
            onClick={onClose}
            className="rounded-full border px-3 py-1 text-sm text-muted-foreground hover:bg-muted/40"
          >
            Close
          </button>
        </div>

        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}