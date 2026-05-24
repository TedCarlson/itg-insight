// path: apps/web/src/shared/ui/loading/InsightLoaderIcon.tsx

type InsightLoaderIconProps = {
  size?: number;
  className?: string;
};

export function InsightLoaderIcon({
  size = 96,
  className = "",
}: InsightLoaderIconProps) {
  return (
    <svg
      width={size}
      height={size * 0.62}
      viewBox="0 0 240 150"
      fill="none"
      className={className}
      role="img"
      aria-label="Loading"
    >
      <path
        d="M15 75C45 20 95 15 120 15C145 15 195 20 225 75C195 130 145 135 120 135C95 135 45 130 15 75Z"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinejoin="round"
      />

      <ellipse
        cx="120"
        cy="75"
        rx="64"
        ry="56"
        stroke="currentColor"
        strokeWidth="6"
      />

      <circle
        cx="120"
        cy="75"
        r="38"
        stroke="currentColor"
        strokeWidth="18"
        strokeDasharray="190 45"
        strokeLinecap="round"
        className="origin-center animate-spin"
        style={{
          transformBox: "fill-box",
          transformOrigin: "center",
          animationDuration: "1.8s",
        }}
      />

      <circle
        cx="120"
        cy="75"
        r="10"
        fill="currentColor"
        className="animate-pulse"
      />

      <path d="M120 15V42" stroke="currentColor" strokeWidth="6" />
      <path d="M120 108V135" stroke="currentColor" strokeWidth="6" />
      <path d="M56 75H84" stroke="currentColor" strokeWidth="6" />
      <path d="M156 75H184" stroke="currentColor" strokeWidth="6" />
    </svg>
  );
}