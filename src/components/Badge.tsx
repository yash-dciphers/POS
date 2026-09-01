const STATUS_KEYS = new Set(['issued', 'draft', 'cancelled', 'pending_approval']);
const LABELS: Record<string, string> = {
  pending_approval: 'Pending Approval',
};

export default function Badge({ status }: { status: string }) {
  const cls = `badge badge-${status}`;
  const label = LABELS[status] ?? status.charAt(0).toUpperCase() + status.slice(1);
  const isStatus = STATUS_KEYS.has(status);
  return (
    <span className={cls}>
      {isStatus && <span className={`badge-dot badge-dot-${status}`} />}
      {label}
    </span>
  );
}
