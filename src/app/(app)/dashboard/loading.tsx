import { SkeletonStatCards, SkeletonTable, SkeletonBlock } from '@/components/Skeleton';

export default function DashboardLoading() {
  return (
    <div>
      <SkeletonStatCards />
      <SkeletonBlock className="h-40 mb-3.5" />
      <SkeletonTable rows={6} cols={6} />
    </div>
  );
}
