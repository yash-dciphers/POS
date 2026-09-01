// A real Indian GSTIN is always 15 characters in a fixed shape: 2-digit
// state code, 10-character PAN embedded inside it (5 letters, 4 digits,
// 1 letter), 1 digit entity code, a literal 'Z', and 1 alphanumeric
// checksum character.
const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export function isValidGstinFormat(gstin: string): boolean {
  const clean = gstin.trim().toUpperCase();
  if (!clean) return true; // empty is fine — GSTIN is optional, this only flags malformed input
  return GSTIN_PATTERN.test(clean);
}
