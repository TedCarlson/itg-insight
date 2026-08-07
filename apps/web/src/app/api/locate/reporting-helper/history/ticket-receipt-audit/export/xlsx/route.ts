import { NextResponse } from 'next/server'
import { supabaseServer } from '@/shared/data/supabase/server'
import { supabaseAdmin } from '@/shared/data/supabase/admin'
import {
  buildTicketReceiptAuditWorkbook,
  type TicketReceiptAuditExportRow,
} from '@/shared/server/locate/reporting-helper/ticketReceiptAuditWorkbook.server'

export const runtime = 'nodejs'

const BATCH_SIZE = 1_000

async function loadAllTicketReceiptAudits() {
  const records: any[] = []

  for (let from = 0; ; from += BATCH_SIZE) {
    const { data, error } = await supabaseAdmin()
      .from('locate_reporting_record')
      .select(
        'locate_reporting_record_id,source_as_of_at,parsed_payload,summary_payload,created_at',
      )
      .eq('report_type', 'TICKET_RECEIPT_AUDIT')
      .order('source_as_of_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .order('locate_reporting_record_id', { ascending: true })
      .range(from, from + BATCH_SIZE - 1)

    if (error) throw new Error(error.message)
    const batch = data ?? []
    records.push(...batch)
    if (batch.length < BATCH_SIZE) break
  }

  return records
}

function nullableText(value: unknown) {
  return value == null ? null : String(value)
}

function normalizeRecord(record: any): TicketReceiptAuditExportRow {
  const parsed = record.parsed_payload ?? {}
  const summary = record.summary_payload ?? {}
  return {
    recordId: String(record.locate_reporting_record_id),
    emailReceivedAt: nullableText(
      parsed.emailReceivedAt ?? summary.email_received_at ?? record.source_as_of_at,
    ),
    family: String(parsed.family ?? summary.family ?? 'Unspecified'),
    ticketNumber: nullableText(parsed.ticketNumber ?? summary.ticket_number),
    comment: nullableText(parsed.comment ?? summary.comment),
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [],
    createdAt: String(record.created_at),
  }
}

export async function GET() {
  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const records = await loadAllTicketReceiptAudits()
    const generatedAt = new Date()
    const workbook = buildTicketReceiptAuditWorkbook(records.map(normalizeRecord), generatedAt)
    const buffer = await workbook.xlsx.writeBuffer()
    const bytes = buffer instanceof Buffer ? buffer : Buffer.from(buffer)
    const datePart = generatedAt.toISOString().slice(0, 10)

    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'content-disposition': `attachment; filename="ticket-receipt-audit-comprehensive-${datePart}.xlsx"`,
        'cache-control': 'private, no-store',
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Export failed' }, { status: 500 })
  }
}
