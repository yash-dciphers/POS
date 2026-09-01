import Link from 'next/link';

const ACCENTS: Record<string, string> = {
  navy: 'border-l-navy',
  gold: 'border-l-gold',
  success: 'border-l-success',
  warn: 'border-l-warn',
  ink: 'border-l-ink',
};

export default function StatCard({
  label,
  value,
  format = 'count',
  accent,
  delay = 0,
  href,
}: {
  label: string;
  value: number;
  format?: 'count' | 'currency';
  accent: 'navy' | 'gold' | 'success' | 'warn' | 'ink';
  delay?: number;
  href?: string;
}) {
  const displayValue =
    format === 'currency'
      ? '₹' + value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : String(Math.round(value));

  // Long currency values (8+ digits with commas) overflow the card at
  // the default 2xl (24px) size. Scale down gracefully instead of
  // clipping — the number is still the visual anchor, just tighter.
  const valueFontClass =
    displayValue.length > 16 ? 'text-base' : displayValue.length > 12 ? 'text-lg' : 'text-2xl';

  const content = (
    <>
      <div className="text-[11px] uppercase font-semibold text-muted">{label}</div>
      <div className={`font-display ${valueFontClass} mt-1 font-mono`} style={{ fontVariantNumeric: 'tabular-nums' }}>
        {displayValue}
      </div>
    </>
  );
  const className = `card card-interactive border-l-[3px] ${ACCENTS[accent]} p-4 animate-fade-in-up block`;
  const style = { animationDelay: `${delay}ms` };

  return href ? (
    <Link href={href} className={className} style={style}>
      {content}
    </Link>
  ) : (
    <div className={className} style={style}>
      {content}
    </div>
  );
}
