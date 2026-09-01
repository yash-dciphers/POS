import { SkeletonTable } from '@/components/Skeleton';

export default function AuditLogLoading() {
  return <SkeletonTable rows={8} cols={4} />;
}
