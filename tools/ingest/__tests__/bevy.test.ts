import { describe, expect, it } from 'vitest';
import { italianAddress } from '../adapters/bevy.js';

describe('italianAddress', () => {
  it('moves the house number after the street', () => {
    expect(italianAddress('2 Via Cardinale Dusmet')).toBe('Via Cardinale Dusmet 2');
  });

  it('handles house numbers with a letter', () => {
    expect(italianAddress('14a Via Cesare Beccaria')).toBe('Via Cesare Beccaria 14a');
  });

  it('works for squares and avenues', () => {
    expect(italianAddress('32 Piazza Dante')).toBe('Piazza Dante 32');
    expect(italianAddress('5 Viale Africa')).toBe('Viale Africa 5');
  });

  it('leaves an address already in Italian order untouched', () => {
    expect(italianAddress('Via Vittorio Emanuele II 12')).toBe('Via Vittorio Emanuele II 12');
  });

  it('leaves alone anything it does not recognise as a street address', () => {
    // "Monastero dei Benedettini" is not a street: reordering would wreck it.
    expect(italianAddress('Monastero dei Benedettini')).toBe('Monastero dei Benedettini');
    expect(italianAddress('12 Downing Street')).toBe('12 Downing Street');
  });

  it('handles "snc" (no street number) like a house number', () => {
    expect(italianAddress('Snc Via Cardinale Dusmet')).toBe('Via Cardinale Dusmet snc');
  });

  it('handles house numbers with a slash', () => {
    expect(italianAddress('31/E Viale Africa')).toBe('Viale Africa 31/E');
  });

  it('trims whitespace and treats blank as absent', () => {
    expect(italianAddress('   ')).toBeUndefined();
    expect(italianAddress(null)).toBeUndefined();
    expect(italianAddress(undefined)).toBeUndefined();
  });
});
