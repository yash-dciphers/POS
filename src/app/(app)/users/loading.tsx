import { SkeletonTable } from '@/components/Skeleton';

export default function UsersLoading() {
  return <SkeletonTable rows={4} cols={4} />;
}
