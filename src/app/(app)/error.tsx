'use client';

import { useEffect } from 'react';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error for debugging — visible in Vercel's runtime logs,
    // not shown to the user.
    console.error('Page error:', error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-md">
        <div className="text-4xl mb-4">⚠</div>
        <h2 className="font-display text-lg font-semibold mb-2">Something went wrong</h2>
        <p className="text-sm text-muted mb-5 leading-relaxed">
          This page ran into an unexpected error. This is usually temporary — try refreshing, and if it
          keeps happening, let your administrator know.
        </p>
        <div className="flex gap-2.5 justify-center">
          <button onClick={reset} className="btn btn-primary text-xs px-4 py-2">
            Try Again
          </button>
          <a href="/dashboard" className="btn btn-outline text-xs px-4 py-2">
            Go to Dashboard
          </a>
        </div>
        {error?.digest && (
          <div className="text-[10px] text-muted mt-4 font-mono">
            Error ID: {error.digest}
          </div>
        )}
      </div>
    </div>
  );
}
