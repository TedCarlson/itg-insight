import ExcelJS from 'exceljs'

export type TicketReceiptAuditExportRow = {
  recordId: string
  emailReceivedAt: string | null
  family: string
  ticketNumber: string | null
  comment: string | null
  warnings: string[]
  createdAt: string
}

const COLORS = {
  ink: 'FF172033',
  navy: 'FF24324A',
  blue: 'FF2563EB',
  paleGray: 'FFF5F7FA',
  border: 'FFD8DEE8',
  muted: 'FF667085',
  white: 'FFFFFFFF',
  green: 'FF166534',
  paleGreen: 'FFDCFCE7',
  amber: 'FF92400E',
  paleAmber: 'FFFEF3C7',
} as const

const BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: COLORS.border } },
  left: { style: 'thin', color: { argb: COLORS.border } },
  bottom: { style: 'thin', color: { argb: COLORS.border } },
  right: { style: 'thin', color: { argb: COLORS.border } },
}

function parsedDate(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function recordDate(row: TicketReceiptAuditExportRow) {
  return parsedDate(row.emailReceivedAt) ?? parsedDate(row.createdAt)
}

function percentage(numerator: number, denominator: number) {
  return denominator ? numerator / denominator : 0
}

function styleTitle(sheet: ExcelJS.Worksheet, range: string, title: string) {
  sheet.mergeCells(range)
  const cell = sheet.getCell(range.split(':')[0])
  cell.value = title
  cell.font = { bold: true, size: 20, color: { argb: COLORS.white } }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.navy } }
  cell.alignment = { vertical: 'middle' }
  sheet.getRow(Number(cell.row)).height = 36
}

function styleSection(sheet: ExcelJS.Worksheet, row: number, title: string, endColumn: number) {
  sheet.mergeCells(row, 1, row, endColumn)
  const cell = sheet.getCell(row, 1)
  cell.value = title
  cell.font = { bold: true, size: 11, color: { argb: COLORS.ink } }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8ECF2' } }
  cell.alignment = { vertical: 'middle' }
  sheet.getRow(row).height = 24
}

function styleHeader(row: ExcelJS.Row) {
  row.height = 28
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: COLORS.white } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.navy } }
    cell.alignment = { vertical: 'middle', wrapText: true }
    cell.border = BORDER
  })
}

function groupRows(
  rows: TicketReceiptAuditExportRow[],
  key: (row: TicketReceiptAuditExportRow) => string,
) {
  const groups = new Map<string, TicketReceiptAuditExportRow[]>()
  for (const row of rows) {
    const label = key(row).trim() || 'Unspecified'
    groups.set(label, [...(groups.get(label) ?? []), row])
  }
  return [...groups.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
}

function monthLabel(row: TicketReceiptAuditExportRow) {
  const date = recordDate(row)
  return date
    ? new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
        date,
      )
    : 'Date unavailable'
}

function uniqueTickets(rows: TicketReceiptAuditExportRow[]) {
  return new Set(rows.map((row) => row.ticketNumber).filter(Boolean)).size
}

function completeRecord(row: TicketReceiptAuditExportRow) {
  return Boolean(row.emailReceivedAt && row.family && row.ticketNumber && row.comment)
}

function actionableWarnings(row: TicketReceiptAuditExportRow) {
  return row.warnings.filter((warning) => !/timestamp was inferred/i.test(warning))
}

function addSummarySheet(
  workbook: ExcelJS.Workbook,
  rows: TicketReceiptAuditExportRow[],
  generatedAt: Date,
) {
  const sheet = workbook.addWorksheet('Executive Summary', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 1 },
  })
  sheet.columns = Array.from({ length: 6 }, () => ({ width: 22 }))
  sheet.views = [{ state: 'frozen', ySplit: 4, showGridLines: false }]
  styleTitle(sheet, 'A1:F1', 'Ticket Receipt Audit — Comprehensive Report')

  sheet.mergeCells('A2:F2')
  sheet.getCell('A2').value =
    'Leadership-ready evidence of saved ticket receipt audit activity across the full reporting history.'
  sheet.getCell('A2').font = { italic: true, color: { argb: COLORS.muted } }
  sheet.getCell('A2').alignment = { vertical: 'middle' }
  sheet.getRow(2).height = 24

  const datedRows = rows
    .map(recordDate)
    .filter((value): value is Date => value != null)
    .sort((a, b) => a.getTime() - b.getTime())
  const firstActivity = datedRows[0] ?? null
  const lastActivity = datedRows.at(-1) ?? null
  sheet.addRow([
    'Generated',
    generatedAt,
    'Reporting scope',
    'All saved records',
    'Activity period',
    firstActivity && lastActivity
      ? `${firstActivity.toLocaleDateString('en-US', { timeZone: 'UTC' })} – ${lastActivity.toLocaleDateString('en-US', { timeZone: 'UTC' })}`
      : 'No dated activity',
  ])
  sheet.getCell('B3').numFmt = 'm/d/yyyy h:mm AM/PM'
  for (const ref of ['A3', 'C3', 'E3']) {
    sheet.getCell(ref).font = { bold: true, color: { argb: COLORS.muted } }
    sheet.getCell(ref).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.paleGray },
    }
  }
  sheet.getRow(3).eachCell((cell) => {
    cell.border = BORDER
    cell.alignment = { vertical: 'middle', wrapText: true }
  })

  styleSection(sheet, 5, 'Effort at a Glance', 6)
  const metrics: Array<[string, number, string]> = [
    ['Audit records', rows.length, '0'],
    ['Unique tickets', uniqueTickets(rows), '0'],
    [
      'Families represented',
      new Set(rows.map((row) => row.family.trim()).filter(Boolean)).size,
      '0',
    ],
    ['Complete records', rows.filter(completeRecord).length, '0'],
    [
      'Ticket capture',
      percentage(rows.filter((row) => row.ticketNumber).length, rows.length),
      '0%',
    ],
    ['Comment capture', percentage(rows.filter((row) => row.comment).length, rows.length), '0%'],
  ]
  metrics.forEach(([label, value, numFmt], index) => {
    const column = index + 1
    const labelCell = sheet.getCell(6, column)
    const valueCell = sheet.getCell(7, column)
    labelCell.value = label
    valueCell.value = value
    valueCell.numFmt = numFmt
    labelCell.font = { bold: true, size: 9, color: { argb: COLORS.muted } }
    labelCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    valueCell.font = {
      bold: true,
      size: 18,
      color: { argb: index >= 4 ? COLORS.blue : COLORS.ink },
    }
    valueCell.alignment = { horizontal: 'center', vertical: 'middle' }
    labelCell.border = BORDER
    valueCell.border = BORDER
  })
  sheet.getRow(7).height = 32

  styleSection(sheet, 9, 'Management Readout', 6)
  const topFamily = groupRows(rows, (row) => row.family)[0]
  const findings = rows.length
    ? [
        `${rows.length} audit record${rows.length === 1 ? '' : 's'} document ${uniqueTickets(rows)} unique ticket${uniqueTickets(rows) === 1 ? '' : 's'}.`,
        topFamily
          ? `${topFamily[0]} is the largest audit family with ${topFamily[1].length} record${topFamily[1].length === 1 ? '' : 's'} (${Math.round(percentage(topFamily[1].length, rows.length) * 100)}%).`
          : null,
        `${rows.filter(completeRecord).length} record${rows.filter(completeRecord).length === 1 ? ' is' : 's are'} complete across timestamp, family, ticket number, and comment.`,
        `${rows.filter((row) => actionableWarnings(row).length > 0).length} record${rows.filter((row) => actionableWarnings(row).length > 0).length === 1 ? ' needs' : 's need'} follow-up for a missing or uncertain field.`,
      ].filter((value): value is string => value != null)
    : ['No saved ticket receipt audit records were available when this report was generated.']

  findings.forEach((finding, index) => {
    const rowNumber = 10 + index
    sheet.mergeCells(rowNumber, 1, rowNumber, 6)
    const cell = sheet.getCell(rowNumber, 1)
    cell.value = `• ${finding}`
    cell.alignment = { vertical: 'middle', wrapText: true }
    cell.border = BORDER
    sheet.getRow(rowNumber).height = 26
  })
  sheet.headerFooter.oddFooter =
    'Insight · Ticket Receipt Audit · Comprehensive Report · Page &P of &N'
}

function addActivitySheet(workbook: ExcelJS.Workbook, rows: TicketReceiptAuditExportRow[]) {
  const sheet = workbook.addWorksheet('Monthly Activity', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  })
  sheet.columns = [
    { width: 24 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
  ]
  styleTitle(sheet, 'A1:F1', 'Monthly Audit Activity')
  sheet.addRow([])
  sheet.addRow([
    'Month',
    'Audit records',
    'Unique tickets',
    'Complete records',
    'Ticket capture',
    'Comment capture',
  ])
  styleHeader(sheet.getRow(3))

  const monthGroups = groupRows(rows, monthLabel).sort((a, b) => {
    const aDate = recordDate(a[1][0])?.getTime() ?? 0
    const bDate = recordDate(b[1][0])?.getTime() ?? 0
    return bDate - aDate
  })
  for (const [month, monthRows] of monthGroups) {
    const row = sheet.addRow([
      month,
      monthRows.length,
      uniqueTickets(monthRows),
      monthRows.filter(completeRecord).length,
      percentage(monthRows.filter((item) => item.ticketNumber).length, monthRows.length),
      percentage(monthRows.filter((item) => item.comment).length, monthRows.length),
    ])
    row.getCell(5).numFmt = '0%'
    row.getCell(6).numFmt = '0%'
    row.eachCell((cell) => {
      cell.border = BORDER
      cell.alignment = { vertical: 'middle' }
    })
  }
  sheet.views = [{ state: 'frozen', ySplit: 3, showGridLines: false }]
  sheet.autoFilter = { from: 'A3', to: 'F3' }
  sheet.headerFooter.oddFooter = 'Insight · Monthly Audit Activity · Page &P of &N'
}

function addFamilySheet(workbook: ExcelJS.Workbook, rows: TicketReceiptAuditExportRow[]) {
  const sheet = workbook.addWorksheet('Family Breakdown', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  })
  sheet.columns = [
    { width: 38 },
    { width: 16 },
    { width: 16 },
    { width: 18 },
    { width: 18 },
    { width: 20 },
    { width: 20 },
  ]
  styleTitle(sheet, 'A1:G1', 'Audit Family Breakdown')
  sheet.addRow([])
  sheet.addRow([
    'Family',
    'Audit records',
    'Share',
    'Unique tickets',
    'Complete records',
    'First activity',
    'Latest activity',
  ])
  styleHeader(sheet.getRow(3))

  for (const [family, familyRows] of groupRows(rows, (row) => row.family)) {
    const dates = familyRows
      .map(recordDate)
      .filter((value): value is Date => value != null)
      .sort((a, b) => a.getTime() - b.getTime())
    const row = sheet.addRow([
      family,
      familyRows.length,
      percentage(familyRows.length, rows.length),
      uniqueTickets(familyRows),
      familyRows.filter(completeRecord).length,
      dates[0] ?? '',
      dates.at(-1) ?? '',
    ])
    row.getCell(3).numFmt = '0%'
    row.getCell(6).numFmt = 'm/d/yyyy'
    row.getCell(7).numFmt = 'm/d/yyyy'
    row.eachCell((cell) => {
      cell.border = BORDER
      cell.alignment = { vertical: 'middle', wrapText: true }
    })
  }
  sheet.views = [{ state: 'frozen', ySplit: 3, showGridLines: false }]
  sheet.autoFilter = { from: 'A3', to: 'G3' }
  sheet.headerFooter.oddFooter = 'Insight · Audit Family Breakdown · Page &P of &N'
}

function addDetailSheet(workbook: ExcelJS.Workbook, rows: TicketReceiptAuditExportRow[]) {
  const sheet = workbook.addWorksheet('Complete Audit Ledger', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  })
  sheet.columns = [
    { width: 9 },
    { width: 22 },
    { width: 34 },
    { width: 20 },
    { width: 58 },
    { width: 18 },
    { width: 34 },
    { width: 22 },
    { width: 38 },
  ]
  styleTitle(sheet, 'A1:I1', 'Complete Ticket Receipt Audit Ledger')
  sheet.mergeCells('A2:I2')
  sheet.getCell('A2').value =
    'One row per saved audit record. Filters are enabled for operational review and follow-up.'
  sheet.getCell('A2').font = { italic: true, color: { argb: COLORS.muted } }
  sheet.getRow(2).height = 24
  sheet.addRow([
    '#',
    'Email received',
    'Family',
    'Ticket number',
    'Comment',
    'Completeness',
    'Warnings',
    'Saved',
    'Record ID',
  ])
  styleHeader(sheet.getRow(3))

  rows.forEach((source, index) => {
    const received = parsedDate(source.emailReceivedAt)
    const saved = parsedDate(source.createdAt)
    const complete = completeRecord(source)
    const row = sheet.addRow([
      index + 1,
      received ?? source.emailReceivedAt ?? '',
      source.family,
      source.ticketNumber ?? '—',
      source.comment ?? '—',
      complete ? 'Complete' : 'Needs review',
      source.warnings.length ? source.warnings.join(' • ') : 'None',
      saved ?? source.createdAt,
      source.recordId,
    ])
    row.getCell(2).numFmt = 'm/d/yyyy h:mm AM/PM'
    row.getCell(4).value = source.ticketNumber
      ? { richText: [{ text: String(source.ticketNumber) }] }
      : '—'
    row.getCell(4).numFmt = '@'
    row.getCell(8).numFmt = 'm/d/yyyy h:mm AM/PM'
    row.getCell(6).font = { bold: true, color: { argb: complete ? COLORS.green : COLORS.amber } }
    row.getCell(6).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: complete ? COLORS.paleGreen : COLORS.paleAmber },
    }
    row.eachCell((cell) => {
      cell.border = BORDER
      cell.alignment = { vertical: 'top', wrapText: true }
    })
    const wrappedLines = Math.max(
      1,
      Math.ceil((source.comment?.length ?? 0) / 54),
      Math.ceil(source.warnings.join(' • ').length / 32),
    )
    row.height = Math.min(72, Math.max(24, wrappedLines * 16))
  })
  sheet.views = [{ state: 'frozen', ySplit: 3, showGridLines: false }]
  sheet.autoFilter = { from: 'A3', to: 'I3' }
  sheet.getColumn(4).alignment = { vertical: 'top' }
  sheet.headerFooter.oddFooter = 'Insight · Complete Ticket Receipt Audit Ledger · Page &P of &N'
}

export function buildTicketReceiptAuditWorkbook(
  rows: TicketReceiptAuditExportRow[],
  generatedAt = new Date(),
) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Insight'
  workbook.created = generatedAt
  workbook.modified = generatedAt
  workbook.subject = 'Comprehensive Ticket Receipt Audit history'
  workbook.title = 'Ticket Receipt Audit — Comprehensive Report'

  addSummarySheet(workbook, rows, generatedAt)
  addActivitySheet(workbook, rows)
  addFamilySheet(workbook, rows)
  addDetailSheet(workbook, rows)
  return workbook
}
