"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/shared/data/supabase/client";

type Attachment = {
  attachment_id: string;
  photo_label_key: string | null;
  file_path: string;
  file_name: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  uploaded_at: string | null;
  deleted_at: string | null;
};

type ResolvedAttachment = Attachment & {
  signedUrl: string | null;
};

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function isImage(mimeType: string | null | undefined) {
  return !!mimeType && mimeType.startsWith("image/");
}

function toObjectPath(filePath: string) {
  return filePath.startsWith("field-log/") ? filePath.slice("field-log/".length) : filePath;
}

export function FieldLogAttachmentsCard(props: {
  attachments: Attachment[];
}) {
  const { attachments } = props;

  const supabase = useMemo(() => createClient(), []);
  const [resolved, setResolved] = useState<ResolvedAttachment[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadUrls() {
      if (!attachments?.length) {
        setResolved([]);
        return;
      }

      const next = await Promise.all(
        attachments.map(async (item) => {
          if (!item.file_path || item.deleted_at) {
            return { ...item, signedUrl: null };
          }

          try {
            const objectPath = toObjectPath(item.file_path);

            const { data, error } = await supabase.storage
              .from("field-log")
              .createSignedUrl(objectPath, 60 * 60);

            if (error || !data?.signedUrl) {
              return { ...item, signedUrl: null };
            }

            return { ...item, signedUrl: data.signedUrl };
          } catch {
            return { ...item, signedUrl: null };
          }
        }),
      );

      if (!cancelled) {
        setResolved(next);
      }
    }

    void loadUrls();

    return () => {
      cancelled = true;
    };
  }, [attachments, supabase]);

  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="text-base font-semibold">Attachments</div>

      {resolved.length ? (
        <div className="mt-3 space-y-3">
          {resolved.map((item) => {
            const canOpen = !!item.signedUrl;
            const image = isImage(item.mime_type);

            return (
              <div key={item.attachment_id} className="rounded-xl border p-3 text-sm">
                {image && item.signedUrl ? (
                  <a
                    href={item.signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mb-3 block"
                  >
                    <div className="relative h-40 w-full overflow-hidden rounded-lg">
                      <Image
                        src={item.signedUrl}
                        alt={item.file_name ?? "Field Log attachment"}
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    </div>
                  </a>
                ) : null}

                <div className="font-medium">{item.file_name ?? item.file_path}</div>

                <div className="mt-1 text-muted-foreground">
                  {item.photo_label_key ?? "general_evidence"}
                </div>

                <div className="mt-1 text-muted-foreground">
                  Uploaded: {fmtDate(item.uploaded_at)}
                </div>

                <div className="mt-3">
                  {canOpen ? (
                    <a
                      href={item.signedUrl!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted"
                    >
                      Open attachment
                    </a>
                  ) : (
                    <div className="text-xs text-muted-foreground">
                      Attachment preview unavailable.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-3 text-sm text-muted-foreground">
          No attachments recorded.
        </div>
      )}
    </section>
  );
}