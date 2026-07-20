import { PageHeader, PageShell } from "@/components/ui/PageShell";
import { LocateReportingNav } from "@/features/locate/reporting-helper/LocateReportingNav";
import { TicketReceiptAuditHistoryClient } from "@/features/locate/reporting-helper/TicketReceiptAuditHistoryClient";
export default function TicketReceiptAuditHistoryPage() { return <PageShell><LocateReportingNav /><PageHeader title="Ticket Receipt Audit History" subtitle="Review saved Ticket Receipt Audit records independently from COTP reporting." /><TicketReceiptAuditHistoryClient /></PageShell>; }
