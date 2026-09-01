import { SkeletonBlock, SkeletonLine } from '@/components/Skeleton';

export default function SetPasswordLoading() {
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <div className="md:flex-[0_0_44%] bg-navy p-6 sm:p-8 md:p-12 min-h-[220px] md:min-h-screen">
        <SkeletonLine className="w-32 h-5 mb-12 bg-white/15" />
        <SkeletonLine className="w-60 h-8 mb-3 bg-white/15" />
        <SkeletonLine className="w-72 h-3 bg-white/15" />
      </div>
      <div className="flex-1 bg-bg flex items-center justify-center p-6">
        <div className="w-full max-w-[360px]">
          <SkeletonLine className="w-36 h-5 mb-2" />
          <SkeletonLine className="w-60 h-3 mb-6" />
          <SkeletonBlock className="h-10 mb-3.5" />
          <SkeletonBlock className="h-10 mb-5" />
          <SkeletonBlock className="h-10" />
        </div>
      </div>
    </div>
  );
}
