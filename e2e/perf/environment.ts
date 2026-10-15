import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Browser, Page } from '@playwright/test';

/** Hardware/browser description stored with every profiling result. */
export async function describeEnvironment(page: Page, browser: Browser) {
  const client = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    return {
      userAgent: navigator.userAgent,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      devicePixelRatio: window.devicePixelRatio,
      webglRenderer: gl
        ? String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER))
        : null,
      hardwareConcurrency: navigator.hardwareConcurrency,
    };
  });
  const cpus = os.cpus();
  return {
    date: new Date().toISOString(),
    browser: `Chromium ${browser.version()}`,
    headless: true,
    os: `${os.type()} ${os.release()} (${os.arch()})`,
    cpu: `${cpus[0]?.model.trim() ?? 'unknown'} × ${cpus.length} threads`,
    memoryGb: Math.round(os.totalmem() / 1024 ** 3),
    softwareGl: Boolean(process.env['PERF_SOFTWARE_GL']),
    ...client,
  };
}

/** Writes a JSON result into docs/profiling and returns its path. */
export function saveResult(name: string, data: unknown): string {
  const dir = path.resolve('docs/profiling');
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const suffix = process.env['PERF_SOFTWARE_GL'] ? '-software-gl' : '';
  const file = path.join(dir, `${name}-${stamp}${suffix}.json`);
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  return file;
}
