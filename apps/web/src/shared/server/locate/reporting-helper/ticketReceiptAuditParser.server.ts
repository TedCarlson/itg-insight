import type { TicketReceiptAuditGeneratedReport } from "./reportingHelperTypes";

const HEADER_LINE = /^(from|sent|to|cc|subject):\s*/i;
const THREAD_BOUNDARY = /^(from:\s|on .+ wrote:|-----original message-----|begin forwarded message:)/i;
const CAUTION_LINE = /^(\*{3}\s*caution:|do not click on links|this email came from outside)/i;
const TICKET_PATTERN = /(?:ticket(?:\s*(?:number|no\.?|#))?\s*[:#-]?\s*#?)(\d{8,14})\b/i;
const ANY_LONG_NUMBER = /\b(\d{10})\b/;

function normalizeWhitespace(value: string) {
  return value.replace(/\r\n?/g, "\n").replace(/[\t ]+/g, " ").trim();
}

function extractHeaderValue(lines: string[], name: string) {
  const prefix = `${name.toLowerCase()}:`;
  const line = lines.find((candidate) => candidate.trim().toLowerCase().startsWith(prefix));
  return line ? line.slice(line.indexOf(":") + 1).trim() : null;
}

function findPrimaryMessage(lines: string[]) {
  const firstFrom = lines.findIndex((line) => /^from:\s/i.test(line.trim()));
  const scoped = firstFrom >= 0 ? lines.slice(firstFrom) : lines;
  const secondFromRelative = scoped.findIndex(
    (line, index) => index > 0 && /^from:\s/i.test(line.trim()),
  );
  const messageBlock = secondFromRelative >= 0 ? scoped.slice(0, secondFromRelative) : scoped;
  const subjectIndex = messageBlock.findIndex((line) => /^subject:\s/i.test(line.trim()));
  const bodyLines = subjectIndex >= 0 ? messageBlock.slice(subjectIndex + 1) : messageBlock;
  return { messageBlock, bodyLines };
}

function extractFirstClassComment(bodyLines: string[]) {
  const cleaned: string[] = [];
  let started = false;

  for (const rawLine of bodyLines) {
    const line = normalizeWhitespace(rawLine);
    if (THREAD_BOUNDARY.test(line)) break;
    if (!line) {
      if (started) break;
      continue;
    }
    if (HEADER_LINE.test(line) || CAUTION_LINE.test(line)) continue;
    if (/^\*{3}/.test(line)) continue;
    started = true;
    cleaned.push(line);
  }

  return cleaned.length ? cleaned.join(" ").replace(/\s+/g, " ").trim() : null;
}

function normalizeFamily(subject: string | null) {
  const normalized = String(subject ?? "")
    .replace(/^\s*(re|fw|fwd):\s*/gi, "")
    .trim();

  if (/unable to locate (?:the )?ticket/i.test(normalized)) {
    return "Unable to locate the Ticket" as const;
  }

  return normalized || "Ticket receipt audit";
}

function normalizeComment(comment: string | null) {
  if (!comment) return null;
  if (/that ticket is not in irth/i.test(comment)) return "Ticket is not in IRTH";
  return comment.replace(/\s+/g, " ").trim();
}

export function generateTicketReceiptAuditReport(rawText: string): TicketReceiptAuditGeneratedReport {
  const source = normalizeWhitespace(rawText);
  if (!source) throw new Error("Paste an email before generating the audit record.");

  const lines = source.split("\n");
  const { messageBlock, bodyLines } = findPrimaryMessage(lines);
  const subject = extractHeaderValue(messageBlock, "subject") ?? extractHeaderValue(lines, "subject");
  const sentAt = extractHeaderValue(messageBlock, "sent") ?? extractHeaderValue(lines, "sent");
  const ticketMatch = source.match(TICKET_PATTERN) ?? source.match(ANY_LONG_NUMBER);
  const ticketNumber = ticketMatch?.[1] ?? null;
  const comment = normalizeComment(extractFirstClassComment(bodyLines));
  const family = normalizeFamily(subject);

  const warnings: string[] = [];
  if (!ticketNumber) warnings.push("Ticket number was not detected.");
  if (!sentAt) warnings.push("Email timestamp was not detected.");
  if (!comment) warnings.push("A first-class email comment was not detected.");
  if (sentAt) warnings.push("Timestamp was inferred from the pasted Sent header; inbound email will use provider received time.");

  return {
    reportName: "TICKET_RECEIPT_AUDIT",
    family,
    ticketNumber,
    emailReceivedAt: sentAt,
    comment,
    sourceScope: "FIRST_CLASS_EMAIL_BODY",
    warnings,
    inspection: {
      email_received_at: sentAt,
      family,
      ticket_number: ticketNumber,
      comment,
    },
  };
}
