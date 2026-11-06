/**
 * Money is stored as integer pesewas (1 GHS = 100 pesewas) and never as a float.
 * GHS is the only currency for now; amounts still travel with a currency code
 * at the API boundary so another currency can be added later.
 */
export const CURRENCY = 'GHS' as const;

/** Convert a cedi amount typed by a person ("1250", "1,250.50", 1250.5) to integer pesewas. */
export function toPesewas(input: number | string): number {
  const text = typeof input === 'number' ? input.toFixed(2) : input.trim().replace(/,/g, '');
  if (!/^-?\d+(\.\d{1,2})?$/.test(text)) {
    throw new Error(`Invalid amount: "${String(input)}"`);
  }
  const negative = text.startsWith('-');
  const [whole = '0', frac = ''] = text.replace('-', '').split('.');
  const pesewas = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  if (!Number.isSafeInteger(pesewas)) throw new Error(`Amount too large: "${String(input)}"`);
  return negative ? -pesewas : pesewas;
}

/** Format integer pesewas for display, e.g. 125050 -> "GHS 1,250.50". */
export function formatGHS(pesewas: number): string {
  if (!Number.isInteger(pesewas)) throw new Error('Pesewas must be an integer');
  const sign = pesewas < 0 ? '-' : '';
  const abs = Math.abs(pesewas);
  const whole = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const frac = String(abs % 100).padStart(2, '0');
  return `${sign}${CURRENCY} ${whole}.${frac}`;
}
