import { describe, it, expect } from 'vitest';
import {
  tagKey,
  tripDurationDays,
  destinationCode,
  computeQuantity,
  type QuantityRule,
} from './types';

describe('tagKey', () => {
  it('lowercases and trims a label', () => {
    expect(tagKey('  Beach  ')).toBe('beach');
  });

  it('normalizes case so labels match regardless of capitalization', () => {
    expect(tagKey('HiKiNg')).toBe('hiking');
  });
});

describe('tripDurationDays', () => {
  it('counts days inclusively between start and end', () => {
    expect(tripDurationDays({ startDate: '2026-06-01', endDate: '2026-06-07' })).toBe(7);
  });

  it('returns 1 for a same-day trip', () => {
    expect(tripDurationDays({ startDate: '2026-06-01', endDate: '2026-06-01' })).toBe(1);
  });

  it('returns null when either date is missing', () => {
    expect(tripDurationDays({ startDate: '2026-06-01' })).toBeNull();
    expect(tripDurationDays({})).toBeNull();
  });

  it('returns null when the end precedes the start', () => {
    expect(tripDurationDays({ startDate: '2026-06-07', endDate: '2026-06-01' })).toBeNull();
  });
});

describe('destinationCode', () => {
  it('uses the first three letters of the primary destination', () => {
    expect(
      destinationCode({ name: 'x', destinations: [{ id: '1', label: 'Portugal', isPrimary: true }] }),
    ).toBe('POR');
  });

  it('prefers an explicit country code over the label', () => {
    expect(
      destinationCode({
        name: 'x',
        destinations: [{ id: '1', label: 'Lisbon', countryCode: 'pt', isPrimary: true }],
      }),
    ).toBe('PT');
  });

  it('strips spaces and punctuation before taking three letters', () => {
    expect(
      destinationCode({ name: 'x', destinations: [{ id: '1', label: 'New York', isPrimary: true }] }),
    ).toBe('NEW');
  });

  it('reads the primary destination, not merely the first', () => {
    expect(
      destinationCode({
        name: 'x',
        destinations: [
          { id: '1', label: 'Faro', isPrimary: false },
          { id: '2', label: 'Berlin', isPrimary: true },
        ],
      }),
    ).toBe('BER');
  });

  it('falls back to the trip name when there is no destination', () => {
    expect(destinationCode({ name: 'Road trip', destinations: [] })).toBe('ROA');
  });

  it('falls back to TRP when nothing usable is present', () => {
    expect(destinationCode({ name: '', destinations: [] })).toBe('TRP');
    expect(destinationCode({ name: '123', destinations: [] })).toBe('TRP');
  });
});

describe('computeQuantity', () => {
  describe('per-day rules', () => {
    const perDay: QuantityRule = { kind: 'perDay', factor: 1, max: 10 };

    it('scales with trip length', () => {
      expect(computeQuantity(perDay, 5, false)).toBe(5);
    });

    it('caps at max for long trips', () => {
      expect(computeQuantity(perDay, 30, false)).toBe(10);
    });

    it('rounds partial days up', () => {
      expect(computeQuantity({ kind: 'perDay', factor: 0.5, max: 10 }, 3, false)).toBe(2);
    });

    it('applies a lower laundry cap only when laundry is available', () => {
      const rule: QuantityRule = { kind: 'perDay', factor: 1, max: 10, laundryCap: 7 };
      expect(computeQuantity(rule, 14, false)).toBe(10);
      expect(computeQuantity(rule, 14, true)).toBe(7);
    });

    it('never returns less than 1', () => {
      expect(computeQuantity(perDay, 0, false)).toBe(1);
    });

    it('defaults to a 7-day trip when length is unknown', () => {
      expect(computeQuantity(perDay, null, false)).toBe(7);
    });
  });

  it('returns a fixed count for per-trip rules', () => {
    expect(computeQuantity({ kind: 'perTrip', count: 1 }, 20, false)).toBe(1);
  });

  describe('bucket rules', () => {
    const bucket: QuantityRule = { kind: 'bucket', weekend: 1, week: 2, long: 3 };

    it('picks the weekend bucket for 3 days or fewer', () => {
      expect(computeQuantity(bucket, 3, false)).toBe(1);
    });

    it('picks the week bucket for 4 to 9 days', () => {
      expect(computeQuantity(bucket, 9, false)).toBe(2);
    });

    it('picks the long bucket beyond 9 days', () => {
      expect(computeQuantity(bucket, 10, false)).toBe(3);
    });

    it('defaults unknown length to the week bucket', () => {
      expect(computeQuantity(bucket, null, false)).toBe(2);
    });
  });

  it('returns 1 for none rules', () => {
    expect(computeQuantity({ kind: 'none' }, 10, false)).toBe(1);
  });
});
