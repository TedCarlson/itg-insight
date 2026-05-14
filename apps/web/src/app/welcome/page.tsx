// apps/web/src/app/welcome/page.tsx

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type WelcomeResponse = {
  ok: boolean;

  auth_user_id: string;
  email: string | null;

  profile: {
    status: string | null;
    person_id: string | null;
    selected_pc_org_id: string | null;
    is_admin: boolean;
  };

  orgs: Array<{
    pc_org_id: string;
    pc_org_name: string | null;
    mso_lob?: string | null;
  }>;

  org_count: number;

  has_verified_access: boolean;

  recommended_pc_org_id: string | null;
};

function cls(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function WelcomePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [payload, setPayload] = useState<WelcomeResponse | null>(null);

  const [selectedPcOrgId, setSelectedPcOrgId] = useState<string>("");

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/welcome", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        const json = (await res.json()) as WelcomeResponse;

        if (!active) return;

        if (!res.ok || !json.ok) {
          throw new Error("Failed to initialize welcome flow.");
        }

        setPayload(json);

        setSelectedPcOrgId(json.recommended_pc_org_id ?? "");

        if (json.has_verified_access) {
          router.replace("/home");
          return;
        }
      } catch (err: any) {
        setError(err?.message ?? "Failed to load welcome flow.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [router]);

  const canContinue = useMemo(() => {
    if (!payload) return false;

    if (payload.org_count === 0) return false;

    return Boolean(selectedPcOrgId);
  }, [payload, selectedPcOrgId]);

  async function handleContinue() {
    try {
      setSubmitting(true);
      setError(null);

      const res = await fetch("/api/welcome", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          selected_pc_org_id: selectedPcOrgId,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? "Failed to complete setup.");
      }

      router.replace(json?.next ?? "/home");
    } catch (err: any) {
      setError(err?.message ?? "Failed to complete setup.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#081018] text-white">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl">
          <div className="mb-4 text-2xl font-semibold">
            Preparing your workspace…
          </div>

          <div className="text-sm text-white/70">
            Verifying account access and organization scope.
          </div>
        </div>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#081018] text-white">
        <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-red-500/10 p-8">
          <div className="mb-2 text-xl font-semibold">
            Welcome setup failed
          </div>

          <div className="text-sm text-white/70">
            {error ?? "Unable to initialize welcome flow."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#081018] px-6 py-10 text-white">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl">
          <div className="mb-2 text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">
            Welcome to Insight
          </div>

          <h1 className="mb-3 text-4xl font-semibold tracking-tight">
            Let’s set up your workspace
          </h1>

          <p className="max-w-2xl text-sm leading-6 text-white/70">
            Before entering the application, select the organization context
            you want to work in. This verifies your access and prepares your
            workspace for reporting, workforce management, and operational
            tooling.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl">
          <div className="mb-5">
            <div className="text-lg font-semibold">Account</div>

            <div className="mt-1 text-sm text-white/60">
              {payload.email ?? "Unknown email"}
            </div>
          </div>

          <div className="mb-6">
            <div className="mb-3 text-sm font-medium text-white/80">
              Organization
            </div>

            {payload.org_count === 0 ? (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                Your account currently has no organization access assigned.
              </div>
            ) : (
              <div className="grid gap-3">
                {payload.orgs.map((org) => {
                  const active = selectedPcOrgId === org.pc_org_id;

                  return (
                    <button
                      key={org.pc_org_id}
                      type="button"
                      onClick={() => setSelectedPcOrgId(org.pc_org_id)}
                      className={cls(
                        "rounded-2xl border p-4 text-left transition",
                        active
                          ? "border-cyan-400 bg-cyan-400/10"
                          : "border-white/10 bg-white/[0.03] hover:border-white/20"
                      )}
                    >
                      <div className="text-base font-medium">
                        {org.pc_org_name ?? "Unnamed Organization"}
                      </div>

                      {org.mso_lob ? (
                        <div className="mt-1 text-xs uppercase tracking-wide text-white/50">
                          {org.mso_lob}
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-white/70">
            Continuing confirms your workspace selection and completes your
            first verified application access.
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
              {error}
            </div>
          ) : null}

          <div className="mt-6 flex items-center justify-end">
            <button
              type="button"
              disabled={!canContinue || submitting}
              onClick={handleContinue}
              className={cls(
                "rounded-2xl px-5 py-3 text-sm font-medium transition",
                canContinue && !submitting
                  ? "bg-cyan-400 text-black hover:bg-cyan-300"
                  : "cursor-not-allowed bg-white/10 text-white/40"
              )}
            >
              {submitting ? "Preparing workspace…" : "Continue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}