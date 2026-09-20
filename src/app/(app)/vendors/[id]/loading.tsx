import { SkeletonBlock, SkeletonLine } from '@/components/Skeleton';

export default function VendorDetailLoading() {
  return (
    <div className="space-y-5" aria-label="Loading vendor details" aria-busy="true">
      <SkeletonLine className="w-24 h-3 mb-3.5" />
      <SkeletonBlock className="h-56" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <SkeletonBlock key={index} className="h-32" />)}
      </div>
      <SkeletonBlock className="h-80" />
    </div>
  );
}
