import { describe, expect, it } from 'vitest';
import { formatGHS, toPesewas } from '../src/money';

describe('money', () => {
  it('converts cedis to integer pesewas without float drift', () => {
    expect(toPesewas('1250')).toBe(125000);
    expect(toPesewas('1,250.50')).toBe(125050);
    expect(toPesewas(19.99)).toBe(1999);
    expect(toPesewas('0.1')).toBe(10);
    expect(toPesewas('-5.05')).toBe(-505);
  });

  it('rejects malformed amounts', () => {
    expect(() => toPesewas('12.345')).toThrow();
    expect(() => toPesewas('abc')).toThrow();
    expect(() => toPesewas('')).toThrow();
  });

  it('formats pesewas as GHS', () => {
    expect(formatGHS(125050)).toBe('GHS 1,250.50');
    expect(formatGHS(5)).toBe('GHS 0.05');
    expect(formatGHS(-100000)).toBe('-GHS 1,000.00');
  });
});
