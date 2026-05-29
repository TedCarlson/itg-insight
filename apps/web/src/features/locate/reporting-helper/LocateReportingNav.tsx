import Link from "next/link";

const links = [
  { href: "/locate/reporting-helper", label: "Reporting Helper" },
  { href: "/locate/reporting-helper/history", label: "Reporting History" },
  { href: "/locate/reporting-helper/progress/cotp", label: "COTP Progress" },
];

export function LocateReportingNav() {
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      <Link
        href="/locate"
        className="to-btn inline-flex rounded-md border px-3 py-2 text-sm font-medium"
        style={{ borderColor: "var(--to-border)" }}
      >
        ← Back to Locate Home
      </Link>

      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="to-btn inline-flex rounded-md border px-3 py-2 text-sm font-medium"
          style={{ borderColor: "var(--to-border)" }}
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}
