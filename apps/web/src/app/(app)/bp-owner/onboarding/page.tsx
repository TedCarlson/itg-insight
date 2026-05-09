// path: apps/web/src/app/(app)/bp-owner/onboarding/page.tsx

import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { Card } from "@/components/ui/Card";
import { PageHeader, PageShell } from "@/components/ui/PageShell";
import { supabaseServer } from "@/shared/data/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BpOwnerOnboardingPage() {
  noStore();

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <PageShell>
      <PageHeader
        title="BP Owner Onboarding"
        subtitle="Prospecting and onboarding pipeline for your business partner company."
      />

      <div id="shell-role-hint" data-shell-role="BP_OWNER" className="hidden" />

      <Card className="p-5">
        <div className="text-sm font-semibold">Coming next</div>
        <p className="mt-2 text-sm text-muted-foreground">
          This surface will default new prospects to the BP affiliation and group
          onboarding progress by participating org.
        </p>
      </Card>
    </PageShell>
  );
}