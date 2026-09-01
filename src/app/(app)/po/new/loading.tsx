import { SkeletonBlock, SkeletonCard } from '@/components/Skeleton';

export default function NewPoLoading() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 items-start">
      <div className="space-y-4">
        <SkeletonCard lines={5} />
        <SkeletonCard lines={5} />
        <SkeletonBlock className="h-72" />
        <SkeletonCard lines={4} />
      </div>
      <div className="sticky top-4">
        <SkeletonCard lines={5} />
      </div>
    </div>
  );
}
