import { SkeletonCard } from '@/components/Skeleton';

export default function SettingsLoading() {
  return (
    <div className="space-y-3.5">
      <SkeletonCard lines={6} />
      <SkeletonCard lines={3} />
    </div>
  );
}
