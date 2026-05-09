// path: apps/web/src/app/(app)/bp-owner/page.tsx

import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { Card } from "@/components/ui/Card";
import { PageHeader, PageShell } from "@/components/ui/PageShell";
import { supabaseServer } from "@/shared/data/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BpOwnerOverviewPage() {
  noStore();

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <PageShell>
      <PageHeader
        title="BP Owner Workspace"
        subtitle="Your company operating view across onboarding, workforce, scheduling, and metrics."
      />

      <div id="shell-role-hint" data-shell-role="BP_OWNER" className="hidden" />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <div className="text-sm font-semibold">Onboarding</div>
          <div className="mt-2 text-3xl font-bold">Pipeline</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Track prospects and onboarding progress by participating org.
          </p>
        </Card>

        <Card className="p-5">
          <div className="text-sm font-semibold">Workforce</div>
          <div className="mt-2 text-3xl font-bold">People</div>
          <p className="mt-2 text-sm text-muted-foreground">
            View people tied directly to your business partner affiliation.
          </p>
        </Card>

        <Card className="p-5">
          <div className="text-sm font-semibold">Scheduling</div>
          <div className="mt-2 text-3xl font-bold">Read only</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Review scheduled coverage without route-lock management actions.
          </p>
        </Card>

        <Card className="p-5">
          <div className="text-sm font-semibold">Metrics</div>
          <div className="mt-2 text-3xl font-bold">Company scoped</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Analyze performance for your direct affiliates only.
          </p>
        </Card>
      </div>

      <Card className="mt-4 p-5">
        <div className="text-sm font-semibold">Workspace posture</div>
        <p className="mt-2 max-w-4xl text-sm text-muted-foreground">
          This workspace is designed for business partner ownership. It keeps the
          Director-style operating rhythm, but limits visibility to your company,
          your prospects, your assigned org coverage, and your direct affiliate
          population.
        </p>
      </Card>
    </PageShell>
  );
}