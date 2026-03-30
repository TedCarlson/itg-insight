"use client";

import OverlayPanel from "@/components/ui/OverlayPanel";

type Section = {
  title: string;
  body: string;
};

type Props = {
  title: string;
  subtitle?: string;
  sections: Section[];
  onClose: () => void;
};

export default function SurfaceHelpOverlay({
  title,
  subtitle,
  sections,
  onClose,
}: Props) {
  return (
    <OverlayPanel title={title} onClose={onClose}>
      <div className="space-y-4">
        {subtitle ? (
          <div className="text-sm text-muted-foreground">{subtitle}</div>
        ) : null}

        <div className="grid gap-3">
          {sections.map((section) => (
            <div
              key={section.title}
              className="rounded-2xl border bg-muted/10 px-4 py-3"
            >
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {section.title}
              </div>
              <div className="mt-1 text-sm leading-6 text-foreground/90">
                {section.body}
              </div>
            </div>
          ))}
        </div>
      </div>
    </OverlayPanel>
  );
}