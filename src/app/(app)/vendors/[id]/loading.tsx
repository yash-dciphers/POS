import { SkeletonBlock, SkeletonLine, SkeletonTable } from '@/components/Skeleton';

export default function VendorDetailLoading() {
  return (
    <div>
      <SkeletonLine className="w-24 h-3 mb-3.5" />
      <SkeletonBlock className="h-32 mb-3.5" />
      <SkeletonTable rows={4} cols={5} />
    </div>
  );
}
