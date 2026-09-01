'use client';

import { useFormStatus } from 'react-dom';
import { Spinner } from './Skeleton';

export default function SubmitButton({
  children,
  pendingText,
  className = 'btn btn-primary',
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button className={className} type="submit" disabled={pending}>
      {pending && <Spinner className="w-3.5 h-3.5" />}
      {pending ? pendingText ?? children : children}
    </button>
  );
}
