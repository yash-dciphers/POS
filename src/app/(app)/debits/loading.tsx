import { SkeletonBlock, SkeletonTable } from '@/components/Skeleton';

export default function DebitsLoading() {
  return (
    <div>
      <div className="grid grid-cols-2 gap-3.5 mb-5">
        <SkeletonBlock className="h-20" />
        <SkeletonBlock className="h-20" />
      </div>
      <SkeletonTable rows={5} cols={8} />
    </div>
  );
}
