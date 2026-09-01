'use client';

export default function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn btn-outline text-xs px-3.5 py-1.5">
      Print
    </button>
  );
}
