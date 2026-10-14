import { describe, expect, it } from 'vitest';
import { TILES, TILESHEET, tileName, tileRect } from './tiles.ts';

describe('tileRect', () => {
  it('maps 1-based row-major ids onto the 16 x 6 grid', () => {
    expect(tileRect(1)).toEqual({ x: 0, y: 0, w: 64, h: 64 });
    expect(tileRect(16)).toEqual({ x: 960, y: 0, w: 64, h: 64 });
    expect(tileRect(17)).toEqual({ x: 0, y: 64, w: 64, h: 64 });
    expect(tileRect(TILES.WATER)).toEqual({ x: 512, y: 256, w: 64, h: 64 });
    expect(tileRect(96)).toEqual({ x: 960, y: 320, w: 64, h: 64 });
  });

  it('rejects ids outside the sheet', () => {
    expect(() => tileRect(0)).toThrow(RangeError);
    expect(() => tileRect(97)).toThrow(RangeError);
    expect(() => tileRect(1.5)).toThrow(RangeError);
  });

  it('builds file names matching the individual PNGs', () => {
    expect(tileName(TILES.WATER)).toBe('tile_73');
  });
});

describe('TILES', () => {
  it('only references ids that exist in the sheet', () => {
    const ids = JSON.stringify(TILES).match(/\d+/g)?.map(Number) ?? [];
    const max = TILESHEET.columns * TILESHEET.rows;
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      expect(id).toBeGreaterThanOrEqual(1);
      expect(id).toBeLessThanOrEqual(max);
    }
  });
});
