/** Importes siempre en centavos enteros. */
export function parseMoney(input: string): number | null {
  const s = input.trim().replace(/[$\s]/g, '').replace(/,/g, '');
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) return null;
  const neg = s.startsWith('-');
  const [i, d = ''] = s.replace('-', '').split('.');
  const cents = Number(i) * 100 + Number(d.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents)) return null;
  return neg ? -cents : cents;
}

export function formatMXN(cents: number): string {
  const neg = cents < 0;
  const abs = Math.abs(cents);
  const int = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${neg ? '-' : ''}$${int}.${(abs % 100).toString().padStart(2, '0')}`;
}
