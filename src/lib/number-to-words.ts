// Converts a rupee amount into words using the Indian numbering system
// (lakh/crore), including paise. Mirrors the format seen on the reference
// POs, e.g. "Rupees Eighty-Eight Lakh Three Thousand Two Hundred Five and
// Fifty-Four Paise Only".
export function numberToWordsIndian(num: number): string {
  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function two(n: number): string {
    if (n < 20) return ones[n];
    return tens[Math.floor(n / 10)] + (n % 10 ? '-' + ones[n % 10] : '');
  }
  function three(n: number): string {
    let s = '';
    if (n >= 100) {
      s += ones[Math.floor(n / 100)] + ' Hundred';
      n %= 100;
      if (n) s += ' ';
    }
    if (n) s += two(n);
    return s;
  }

  if (num === 0) return 'Rupees Zero Only';

  let rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);

  const crore = Math.floor(rupees / 10000000); rupees %= 10000000;
  const lakh = Math.floor(rupees / 100000); rupees %= 100000;
  const thousand = Math.floor(rupees / 1000); rupees %= 1000;
  const hundred = rupees;

  const parts: string[] = [];
  if (crore) parts.push(three(crore) + ' Crore');
  if (lakh) parts.push(three(lakh) + ' Lakh');
  if (thousand) parts.push(three(thousand) + ' Thousand');
  if (hundred) parts.push(three(hundred));

  let words = 'Rupees ' + (parts.length ? parts.join(' ') : 'Zero');
  if (paise > 0) words += ' and ' + two(paise) + ' Paise';
  return words + ' Only';
}
