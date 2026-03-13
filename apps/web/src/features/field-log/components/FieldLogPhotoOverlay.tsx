"use client";

import Image from "next/image";
import { useEffect } from "react";

type OverlayPhoto = {
  attachment_id: string;
  file_name: string | null;
  signedUrl: string | null;
};

export function FieldLogPhotoOverlay(props: {
  open: boolean;
  photos: OverlayPhoto[];
  activeIndex: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const { open, photos, activeIndex, onClose, onPrev, onNext } = props;

  const activePhoto =
    activeIndex >= 0 && activeIndex < photos.length ? photos[activeIndex] : null;

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, onPrev, onNext]);

  if (!open || !activePhoto?.signedUrl) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4">
      <button
        type="button"
        aria-label="Close photo viewer"
        className="absolute inset-0"
        onClick={onClose}
      />

      <div className="relative z-[101] flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">
              {activePhoto.file_name ?? "Attachment"}
            </div>
            <div className="text-xs text-muted-foreground">
              {activeIndex + 1} of {photos.length}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            Close
          </button>
        </div>

        <div className="relative flex min-h-[55vh] items-center justify-center bg-black/5 p-4">
          <button
            type="button"
            onClick={onPrev}
            disabled={activeIndex <= 0}
            className="absolute left-3 top-1/2 z-[102] -translate-y-1/2 rounded-full border bg-background/95 px-3 py-2 text-sm font-medium shadow disabled:opacity-40"
            aria-label="Previous photo"
          >
            Prev
          </button>

          <div className="relative h-[60vh] w-full max-w-4xl">
            <Image
              src={activePhoto.signedUrl}
              alt={activePhoto.file_name ?? "Attachment"}
              fill
              unoptimized
              className="object-contain"
            />
          </div>

          <button
            type="button"
            onClick={onNext}
            disabled={activeIndex >= photos.length - 1}
            className="absolute right-3 top-1/2 z-[102] -translate-y-1/2 rounded-full border bg-background/95 px-3 py-2 text-sm font-medium shadow disabled:opacity-40"
            aria-label="Next photo"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}