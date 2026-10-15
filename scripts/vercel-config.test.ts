import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Guards the deployment configuration: Vercel rejects the whole project when
 * vercel.json is not strict JSON (Prettier and ESLint do not catch it).
 */
interface VercelConfig {
  rewrites: { source: string; destination: string }[];
  headers: { source: string }[];
}

const raw = readFileSync(new URL('../vercel.json', import.meta.url), 'utf8');

describe('vercel.json', () => {
  it('is strict JSON', () => {
    expect(() => JSON.parse(raw) as unknown).not.toThrow();
  });

  it('rewrites app routes to index.html but never real files (real 404s for assets)', () => {
    const config = JSON.parse(raw) as VercelConfig;
    const [rewrite] = config.rewrites;
    expect(rewrite?.destination).toBe('/index.html');
    const pattern = new RegExp(`^${rewrite?.source ?? ''}$`);
    for (const route of ['/', '/options', '/any/deep/link']) expect(pattern.test(route)).toBe(true);
    for (const file of ['/assets/png/x.png', '/static/index-abc.js', '/mockServiceWorker.js']) {
      expect(pattern.test(file)).toBe(false);
    }
  });

  it('never caches the service worker and caches hashed bundles for a year', () => {
    const config = JSON.parse(raw) as VercelConfig;
    expect(config.headers.map((header) => header.source)).toEqual(
      expect.arrayContaining(['/static/(.*)', '/mockServiceWorker.js']),
    );
    expect(raw).toContain('immutable');
    expect(raw).toContain('no-cache');
  });
});
