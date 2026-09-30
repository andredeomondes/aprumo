export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand-mark ${compact ? "compact" : ""}`} aria-hidden="true">
      <img src="/aprumo-logo.webp" alt="" width={34} height={34} />
    </span>
  );
}
