import CalendarGovernanceEditor from "@/features/admin/calendar-governance/components/CalendarGovernanceEditor";
import ManualBlackoutRuleForm from "@/features/admin/calendar-governance/components/ManualBlackoutRuleForm";
import CalendarGovernanceTable from "@/features/admin/calendar-governance/components/CalendarGovernanceTable";
import { loadCalendarGovernancePage } from "@/features/admin/calendar-governance/server/loadCalendarGovernancePage.server";

export default async function Page() {
  const { blackoutByDate, governanceRows } =
    await loadCalendarGovernancePage();

  const days = Array.from(blackoutByDate.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Calendar Governance</h1>
        <p className="mt-1 text-sm text-[var(--to-ink-muted)]">
          Manage fixed holiday blackout dates and admin-added blackout coverage.
        </p>
      </div>

      <CalendarGovernanceEditor rows={governanceRows} />

      <ManualBlackoutRuleForm />

      <CalendarGovernanceTable days={days} />
    </div>
  );
}
