// Normalizes any way someone might type an Indian mobile number — with or
// without +91, with or without a leading 0, with spaces/dashes — down to a
// clean 10-digit string for storage. Storing the raw digits (not a
// pre-formatted string) means display formatting stays consistent no matter
// how it was typed in, and can't accidentally end up as "+91 0XXXXXXXXXX".
export function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  // Strip a leading '91' country code digit-string, then a leading '0' if
  // present, leaving the bare 10-digit subscriber number.
  let clean = digits;
  if (clean.length > 10 && clean.startsWith('91')) clean = clean.slice(2);
  if (clean.length === 11 && clean.startsWith('0')) clean = clean.slice(1);
  return clean.slice(-10);
}

// Formats a normalized (or raw) number for display: "+91 XXXXXXXXXX".
export function formatPhone(input: string | null | undefined): string {
  if (!input) return '';
  const clean = normalizePhone(input);
  return clean.length === 10 ? `+91 ${clean}` : input;
}
