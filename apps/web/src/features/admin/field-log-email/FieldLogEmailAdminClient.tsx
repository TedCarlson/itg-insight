"use client";

import { useEffect, useState } from "react";

type Recipient = {
  id: string;
  email: string;
  enabled: boolean;
  created_at: string;
};

export default function FieldLogEmailAdminClient() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [email, setEmail] = useState("");
  const [fallbackEmail, setFallbackEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/field-log-email", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setMessage(json.error || "Failed to load recipients.");
    } else {
      setRecipients(json.recipients ?? []);
      setFallbackEmail(json.fallbackEmail ?? "");
    }
    setLoading(false);
  }

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, []);

  async function addRecipient() {
    setSaving(true);
    setMessage(null);

    const res = await fetch("/api/admin/field-log-email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const json = await res.json();
    if (!res.ok || !json.ok) {
      setMessage(json.error || "Failed to add recipient.");
    } else {
      setEmail("");
      await load();
      setMessage("Recipient saved.");
    }

    setSaving(false);
  }

  async function removeRecipient(id: string) {
    setSaving(true);
    setMessage(null);

    const res = await fetch(`/api/admin/field-log-email?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });

    const json = await res.json();
    if (!res.ok || !json.ok) {
      setMessage(json.error || "Failed to remove recipient.");
    } else {
      await load();
      setMessage("Recipient removed.");
    }

    setSaving(false);
  }

  return (
    <div className="max-w-3xl space-y-6 pt-6">
      <div>
        <h1 className="text-2xl font-semibold">Field Log Email Recipients</h1>
        <p className="mt-1 text-sm text-[var(--to-ink-muted)]">
          Control who receives approved New Drop and Conduit Pull billing packets.
        </p>
      </div>

      <div className="rounded border p-4" style={{ borderColor: "var(--to-border)" }}>
        <div className="text-sm font-semibold">Add recipient</div>
        <p className="mt-1 text-xs text-[var(--to-ink-muted)]">
          Adding a recipient saves immediately and includes that address on future Field Log billing packet emails.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            className="w-full rounded border bg-transparent px-3 py-2 text-sm"
            style={{ borderColor: "var(--to-border)" }}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
          />
          <button
            type="button"
            onClick={addRecipient}
            disabled={saving || !email.trim()}
            className="rounded border px-4 py-2 text-sm font-semibold hover:bg-[var(--to-surface-2)] disabled:cursor-not-allowed disabled:opacity-50"
            style={{ borderColor: "var(--to-border)" }}
          >
            {saving ? "Saving..." : "Add Recipient"}
          </button>
        </div>
      </div>

      <div className="rounded border p-4" style={{ borderColor: "var(--to-border)" }}>
        <div className="text-sm font-semibold">Active recipients</div>
        {loading ? (
          <div className="mt-3 text-sm text-[var(--to-ink-muted)]">Loading...</div>
        ) : recipients.length === 0 ? (
          <div className="mt-3 text-sm text-[var(--to-ink-muted)]">
            No configured recipients. Fallback will be used: {fallbackEmail}
          </div>
        ) : (
          <div className="mt-3 divide-y" style={{ borderColor: "var(--to-border)" }}>
            {recipients.map((recipient) => (
              <div key={recipient.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <div className="text-sm font-medium">{recipient.email}</div>
                  <div className="text-xs text-[var(--to-ink-muted)]">
                    {recipient.enabled ? "Enabled" : "Disabled"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeRecipient(recipient.id)}
                  disabled={saving}
                  className="rounded border px-3 py-1.5 text-xs hover:bg-[var(--to-surface-2)] disabled:opacity-50"
                  style={{ borderColor: "var(--to-border)" }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {message ? <div className="text-sm text-[var(--to-ink-muted)]">{message}</div> : null}
    </div>
  );
}
