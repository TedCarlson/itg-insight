import { PageHeader, PageShell } from "@/components/ui/PageShell";
import { LocateReportingNav } from "@/features/locate/reporting-helper/LocateReportingNav";
import { CotpHistoryClient } from "@/features/locate/reporting-helper/CotpHistoryClient";
export default function CotpHistoryPage() { return <PageShell><LocateReportingNav /><PageHeader title="COTP History" subtitle="Review canonical saved COTP reports and export historical records." /><CotpHistoryClient /></PageShell>; }
