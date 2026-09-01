import { SkeletonTable } from '@/components/Skeleton';

export default function VendorsLoading() {
  return <SkeletonTable rows={6} cols={4} />;
}
