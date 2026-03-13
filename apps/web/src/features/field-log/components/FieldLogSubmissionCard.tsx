"use client";

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function labelEvidence(value: string | null | undefined) {
  if (!value || value === "none") return "None";
  if (value === "field_upload") return "Field Upload";
  if (value === "xm_platform") return "XM Platform";
  return value.replaceAll("_", " ");
}

function hasLocation(lat: number | null | undefined, lng: number | null | undefined) {
  return lat != null && lng != null;
}

function mapHref(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export function FieldLogSubmissionCard(props: {
  createdAt: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  photoCount: number | null;
  evidenceDeclared: string | null;
  xmDeclared: boolean | null;
  xmLinkValid: boolean | null;
  xmLink: string | null;
  pcOrgId?: string | null;
  gpsLat?: number | null;
  gpsLng?: number | null;
  gpsAccuracyM?: number | null;
  locationCapturedAt?: string | null;
}) {
  const {
    createdAt,
    submittedAt,
    approvedAt,
    photoCount,
    evidenceDeclared,
    xmDeclared,
    xmLink,
    gpsLat,
    gpsLng,
    gpsAccuracyM,
    locationCapturedAt,
  } = props;

  const showXmSection = !!xmDeclared;
  const hasXmLink = !!xmLink;
  const showLocation = hasLocation(gpsLat, gpsLng);

  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="text-base font-semibold">Submission</div>

      <div className="mt-3 space-y-2 text-sm">
        <div>Created: {fmtDate(createdAt)}</div>
        <div>Submitted: {fmtDate(submittedAt)}</div>
        <div>Approved: {fmtDate(approvedAt)}</div>
        <div>Photos: {photoCount ?? 0}</div>
        <div>Evidence: {labelEvidence(evidenceDeclared)}</div>

        {showXmSection ? (
          hasXmLink ? (
            <div>
              XM Link:{" "}
              <a
                href={xmLink!}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-700 underline"
              >
                Open XM record
              </a>
            </div>
          ) : (
            <div>XM Link: Pending</div>
          )
        ) : null}

        {showLocation ? (
          <div className="pt-1">
            <div>Location: Captured</div>
            {gpsAccuracyM != null ? (
              <div className="text-muted-foreground">
                Accuracy: {Math.round(gpsAccuracyM)}m
              </div>
            ) : null}
            {locationCapturedAt ? (
              <div className="text-muted-foreground">
                Captured: {fmtDate(locationCapturedAt)}
              </div>
            ) : null}
            <div className="mt-1">
              <a
                href={mapHref(gpsLat!, gpsLng!)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-700 underline"
              >
                View Map
              </a>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}