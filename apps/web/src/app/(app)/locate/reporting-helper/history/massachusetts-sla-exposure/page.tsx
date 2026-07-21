import { PageHeader, PageShell } from "@/components/ui/PageShell";
import { LocateReportingNav } from "@/features/locate/reporting-helper/LocateReportingNav";
import { MassachusettsSlaExposureHistoryClient } from "@/features/locate/reporting-helper/MassachusettsSlaExposureHistoryClient";
export default function Page(){return <PageShell><LocateReportingNav/><PageHeader title="Massachusetts SLA Exposure History" subtitle="Compare saved Ticket Summary snapshots and monitor COTP penalty exposure over time."/><MassachusettsSlaExposureHistoryClient/></PageShell>}
