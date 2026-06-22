import { describe, it, expect } from 'vitest';
import { migrate, emptyData, CURRENT_SCHEMA_VERSION } from './appData';

describe('migrate', () => {
  it('returns empty data for null/garbage input', () => {
    expect(migrate(null)).toEqual(emptyData());
    expect(migrate('nope')).toEqual(emptyData());
    expect(migrate(42)).toEqual(emptyData());
  });

  it('keeps valid trips and library arrays and stamps the current version', () => {
    const raw = { schemaVersion: 0, trips: [{ id: 't1' }], library: [{ id: 'd:passport' }] };
    const data = migrate(raw);
    expect(data.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(data.trips).toHaveLength(1);
    expect(data.library).toHaveLength(1);
  });

  it('defaults missing arrays to empty', () => {
    expect(migrate({})).toEqual(emptyData());
    expect(migrate({ trips: 'bad', library: null })).toEqual(emptyData());
  });
});
