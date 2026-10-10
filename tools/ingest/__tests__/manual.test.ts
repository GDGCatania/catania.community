import { describe, expect, it } from 'vitest';
import { withImplicitManual } from '../adapters/manual.js';

describe('withImplicitManual', () => {
  it('adds the manual source to every community', () => {
    expect(withImplicitManual([{ type: 'ics', url: 'https://example.org/e.ics' }])).toEqual([
      { type: 'ics', url: 'https://example.org/e.ics' },
      { type: 'manual' },
    ]);
    expect(withImplicitManual([])).toEqual([{ type: 'manual' }]);
  });

  it('does not add it twice', () => {
    expect(withImplicitManual([{ type: 'manual' }])).toEqual([{ type: 'manual' }]);
  });
});
