'use client';

export default function LoginError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="text-center max-w-md p-8">
        <div className="text-4xl mb-4">⚠</div>
        <h2 className="font-display text-lg font-semibold mb-2">Something went wrong</h2>
        <p className="text-sm text-muted mb-5">
          The login page ran into an error. Try refreshing the page.
        </p>
        <button onClick={reset} className="btn btn-primary text-xs px-4 py-2">
          Try Again
        </button>
      </div>
    </div>
  );
}
