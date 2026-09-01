import { SkeletonBlock, SkeletonLine } from '@/components/Skeleton';

export default function PoDetailLoading() {
  return (
    <div className="max-w-3xl mx-auto">
      <SkeletonLine className="w-24 h-3 mb-3.5" />
      <div className="flex gap-2.5 mb-3.5">
        <SkeletonBlock className="h-8 w-20" />
        <SkeletonBlock className="h-8 w-20" />
        <SkeletonBlock className="h-8 w-28" />
      </div>
      <SkeletonBlock className="h-[600px]" />
    </div>
  );
}
