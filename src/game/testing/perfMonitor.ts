/**
 * Frame-time and entity profiler, enabled with `?perf=1` (real clock, unlike the
 * `?e2e=1` test clock). Allocation-free per frame: frame intervals and update costs
 * go into fixed ring buffers; entity counts are sampled twice per second.
 *
 * `window.__PB_PERF__.report()` returns the aggregated numbers used by the
 * profiling run (`npm run perf`) and documented in docs/PROFILING.md.
 */

export interface EntityCounts {
  readonly ships: number;
  readonly projectiles: number;
  readonly effects: number;
  readonly displayObjects: number;
}

interface Distribution {
  readonly avg: number;
  readonly p50: number;
  readonly p95: number;
  readonly p99: number;
  readonly max: number;
}

export interface PerfReport {
  readonly frames: number;
  readonly durationSec: number;
  readonly avgFps: number;
  /** Interval between consecutive frames (what the player perceives). */
  readonly frameMs: Distribution;
  /** CPU time of one tick: simulation steps + scene sync (excludes GPU work). */
  readonly updateMs: Distribution;
  /** Frames whose interval exceeded 25 ms (visible hitch) and 33.3 ms (2+ frames lost). */
  readonly framesOver: { readonly ms25: number; readonly ms33_3: number };
  readonly entities: Readonly<
    Record<keyof EntityCounts, { readonly avg: number; readonly max: number }>
  >;
  readonly samples: readonly (EntityCounts & { readonly t: number; readonly fps: number })[];
  readonly heapUsedMb: number | null;
}

const CAPACITY = 1 << 15; // ~9 minutes at 60 FPS
const SAMPLE_EVERY_MS = 500;

function distribution(values: Float32Array, count: number): Distribution {
  if (count === 0) return { avg: 0, p50: 0, p95: 0, p99: 0, max: 0 };
  const sorted = Array.from(values.subarray(0, count)).sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.min(count - 1, Math.floor(q * count))] ?? 0;
  const sum = sorted.reduce((total, value) => total + value, 0);
  const round = (value: number) => Math.round(value * 100) / 100;
  return {
    avg: round(sum / count),
    p50: round(at(0.5)),
    p95: round(at(0.95)),
    p99: round(at(0.99)),
    max: round(sorted[count - 1] ?? 0),
  };
}

export class PerfMonitor {
  private readonly frameMs = new Float32Array(CAPACITY);
  private readonly updateMs = new Float32Array(CAPACITY);
  private count = 0;
  private written = 0;
  private elapsedMs = 0;
  private sinceSampleMs = 0;
  private framesSinceSample = 0;
  private samples: (EntityCounts & { t: number; fps: number })[] = [];
  private overlay: HTMLElement | null = null;

  /** Records one frame. `counts` is only called when a sample is due. */
  frame(deltaMs: number, updateMs: number, counts: () => EntityCounts): void {
    const index = this.written % CAPACITY;
    this.frameMs[index] = deltaMs;
    this.updateMs[index] = updateMs;
    this.written++;
    this.count = Math.min(CAPACITY, this.count + 1);
    this.elapsedMs += deltaMs;
    this.sinceSampleMs += deltaMs;
    this.framesSinceSample++;

    if (this.sinceSampleMs >= SAMPLE_EVERY_MS) {
      const fps = (this.framesSinceSample * 1000) / this.sinceSampleMs;
      const sample = { t: Math.round(this.elapsedMs), fps: Math.round(fps * 10) / 10, ...counts() };
      this.samples.push(sample);
      this.sinceSampleMs = 0;
      this.framesSinceSample = 0;
      if (this.overlay) {
        this.overlay.textContent = `FPS ${Math.round(fps)} · ships ${sample.ships} · shots ${sample.projectiles} · fx ${sample.effects}`;
      }
    }
  }

  reset(): void {
    this.count = 0;
    this.written = 0;
    this.elapsedMs = 0;
    this.sinceSampleMs = 0;
    this.framesSinceSample = 0;
    this.samples = [];
  }

  report(): PerfReport {
    const entity = (key: keyof EntityCounts) => {
      const values = this.samples.map((sample) => sample[key]);
      const max = values.length ? Math.max(...values) : 0;
      const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      return { avg: Math.round(avg * 10) / 10, max };
    };
    let over25 = 0;
    let over33 = 0;
    for (let i = 0; i < this.count; i++) {
      const value = this.frameMs[i] ?? 0;
      if (value > 25) over25++;
      if (value > 33.3) over33++;
    }
    const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    return {
      frames: this.count,
      durationSec: Math.round(this.elapsedMs) / 1000,
      avgFps: this.elapsedMs > 0 ? Math.round((this.count * 1000 * 10) / this.elapsedMs) / 10 : 0,
      frameMs: distribution(this.frameMs, this.count),
      updateMs: distribution(this.updateMs, this.count),
      framesOver: { ms25: over25, ms33_3: over33 },
      entities: {
        ships: entity('ships'),
        projectiles: entity('projectiles'),
        effects: entity('effects'),
        displayObjects: entity('displayObjects'),
      },
      samples: this.samples,
      heapUsedMb: memory ? Math.round(memory.usedJSHeapSize / 1048576) : null,
    };
  }

  /** Small corner readout (purely informative, ignored by screen readers). */
  showOverlay(): void {
    if (this.overlay || typeof document === 'undefined') return;
    const element = document.createElement('div');
    element.setAttribute('aria-hidden', 'true');
    element.className = 'perf-overlay';
    document.body.appendChild(element);
    this.overlay = element;
  }

  hideOverlay(): void {
    this.overlay?.remove();
    this.overlay = null;
  }
}

declare global {
  interface Window {
    __PB_PERF__?: PerfMonitor;
  }
}

const enabled =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('perf') === '1';

/** The session's monitor in `?perf=1` mode, otherwise null. */
export const perfMonitor: PerfMonitor | null = enabled ? new PerfMonitor() : null;

if (perfMonitor) window.__PB_PERF__ = perfMonitor;
