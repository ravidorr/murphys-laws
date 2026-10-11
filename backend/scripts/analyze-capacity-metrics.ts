/**
 * Capacity analysis from operational metrics CSV files.
 * Used by cost-optimization-report.sh (stdout: human-readable section).
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const METRICS_HEADER =
  'timestamp,role,frontend_response_ms,api_response_ms,db_query_ms,memory_used_mb,memory_available_mb,memory_pressure_percent,swap_used_mb,swap_in,swap_out,cpu_cores,cpu_load_1m,cpu_load_5m,cpu_load_15m,cpu_normalized_percent,disk_used_gb,disk_available_gb,disk_percent,db_size_mb,pm2_api_restarts,pm2_api_uptime_hours,pm2_api_rss_mb,pm2_api_memory_limit_mb,collector_errors';

export type CapacityDecision =
  | 'Collecting baseline'
  | 'No change justified'
  | 'Manual review candidate';

export interface CapacityThresholds {
  windowDays: number;
  minCoverageRatio: number;
  maxMemoryPressurePercent: number;
  minMemoryAvailableMb: number;
  maxCpuNormalizedPercent: number;
  maxPm2ApiRssMb: number;
  maxSwapUsedMb: number;
  minPm2MemoryHeadroomMb: number;
}

export const DEFAULT_THRESHOLDS: CapacityThresholds = {
  windowDays: 30,
  minCoverageRatio: 0.9,
  maxMemoryPressurePercent: 70,
  minMemoryAvailableMb: 200,
  maxCpuNormalizedPercent: 50,
  maxPm2ApiRssMb: 350,
  maxSwapUsedMb: 0,
  minPm2MemoryHeadroomMb: 100,
};

export interface MetricRow {
  timestamp: string;
  role: string;
  memoryAvailableMb: number | null;
  memoryPressurePercent: number | null;
  swapUsedMb: number | null;
  cpuNormalizedPercent: number | null;
  pm2ApiRssMb: number | null;
  pm2ApiMemoryLimitMb: number | null;
  collectorErrors: string;
}

function parseNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '' || trimmed.toLowerCase() === 'n/a') {
    return null;
  }
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function parseMetricsCsv(content: string): MetricRow[] {
  const lines = content.split('\n').filter((line) => line.trim() !== '');
  if (lines.length < 2) {
    return [];
  }
  const header = lines[0].split(',');
  const idx = (name: string): number => header.indexOf(name);
  const legacy = idx('role') < 0;

  const rows: MetricRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < header.length) {
      continue;
    }
    const pressureCol = legacy ? 'memory_percent' : 'memory_pressure_percent';
    let cpuNorm = parseNumber(cols[idx('cpu_normalized_percent')] ?? '');
    if (cpuNorm === null && legacy) {
      const load = parseNumber(cols[idx('cpu_load_1m')] ?? '');
      const cores = parseNumber(cols[idx('cpu_cores')] ?? '') ?? 1;
      if (load !== null && cores > 0) {
        cpuNorm = (load / cores) * 100;
      }
    }
    rows.push({
      timestamp: cols[idx('timestamp')] ?? '',
      role: legacy ? 'main-app' : (cols[idx('role')] ?? ''),
      memoryAvailableMb: parseNumber(cols[idx('memory_available_mb')] ?? ''),
      memoryPressurePercent: parseNumber(cols[idx(pressureCol)] ?? ''),
      swapUsedMb: parseNumber(cols[idx('swap_used_mb')] ?? ''),
      cpuNormalizedPercent: cpuNorm,
      pm2ApiRssMb: parseNumber(cols[idx('pm2_api_rss_mb')] ?? ''),
      pm2ApiMemoryLimitMb: parseNumber(cols[idx('pm2_api_memory_limit_mb')] ?? ''),
      collectorErrors: cols[idx('collector_errors')] ?? '',
    });
  }
  return rows;
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(rank, sorted.length - 1))];
}

export interface CapacityAnalysis {
  decision: CapacityDecision;
  role: string;
  sampleCount: number;
  expectedSamples: number;
  coverageRatio: number;
  peakMemoryPressurePercent: number | null;
  p95MemoryPressurePercent: number | null;
  minMemoryAvailableMb: number | null;
  peakCpuNormalizedPercent: number | null;
  peakSwapUsedMb: number | null;
  peakPm2ApiRssMb: number | null;
  reasons: string[];
  downsizingBlockedNote: string;
}

export function analyzeCapacity(
  rows: MetricRow[],
  role: string,
  thresholds: CapacityThresholds = DEFAULT_THRESHOLDS,
  now: Date = new Date(),
): CapacityAnalysis {
  const roleRows = rows.filter((r) => r.role === role || (role === 'main-app' && r.role === ''));
  const windowStart = new Date(now.getTime() - thresholds.windowDays * 24 * 60 * 60 * 1000);
  const inWindow = roleRows.filter((r) => {
    const t = Date.parse(r.timestamp);
    return Number.isFinite(t) && t >= windowStart.getTime();
  });

  const expectedSamples = thresholds.windowDays * 24;
  const sampleCount = inWindow.length;
  const hourBuckets = new Set<string>();
  for (const row of inWindow) {
    const parsed = Date.parse(row.timestamp);
    if (!Number.isFinite(parsed)) {
      continue;
    }
    const date = new Date(parsed);
    const bucket = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}T${String(date.getUTCHours()).padStart(2, '0')}`;
    hourBuckets.add(bucket);
  }
  const distinctHourCount = hourBuckets.size;
  const coverageRatio = expectedSamples > 0 ? distinctHourCount / expectedSamples : 0;

  const memoryPressure = inWindow
    .map((r) => r.memoryPressurePercent)
    .filter((v): v is number => v !== null);
  const memoryAvailable = inWindow
    .map((r) => r.memoryAvailableMb)
    .filter((v): v is number => v !== null);
  const cpuNorm = inWindow
    .map((r) => r.cpuNormalizedPercent)
    .filter((v): v is number => v !== null);
  const swapUsed = inWindow.map((r) => r.swapUsedMb).filter((v): v is number => v !== null);
  const pm2Rss = inWindow.map((r) => r.pm2ApiRssMb).filter((v): v is number => v !== null);

  const collectorErrorRows = inWindow.filter((r) => r.collectorErrors.trim() !== '').length;

  const reasons: string[] = [];
  const downsizingBlockedNote =
    '512MB droplets remain blocked: this host previously OOMed on 1GB with 2GB swap. Downsizing requires sustained headroom, zero swap pressure, and explicit manual approval.';

  if (distinctHourCount === 0 || coverageRatio < thresholds.minCoverageRatio) {
    reasons.push(
      `Insufficient metrics coverage (${distinctHourCount}/${expectedSamples} distinct hourly buckets in last ${thresholds.windowDays} days; ${sampleCount} raw samples).`,
    );
    return {
      decision: 'Collecting baseline',
      role,
      sampleCount: distinctHourCount,
      expectedSamples,
      coverageRatio,
      peakMemoryPressurePercent: memoryPressure.length ? Math.max(...memoryPressure) : null,
      p95MemoryPressurePercent: percentile(memoryPressure, 95),
      minMemoryAvailableMb: memoryAvailable.length ? Math.min(...memoryAvailable) : null,
      peakCpuNormalizedPercent: cpuNorm.length ? Math.max(...cpuNorm) : null,
      peakSwapUsedMb: swapUsed.length ? Math.max(...swapUsed) : null,
      peakPm2ApiRssMb: pm2Rss.length ? Math.max(...pm2Rss) : null,
      reasons,
      downsizingBlockedNote,
    };
  }

  if (collectorErrorRows > 0) {
    reasons.push(`${collectorErrorRows} samples reported collector errors.`);
  }

  const peakMemoryPressure = memoryPressure.length ? Math.max(...memoryPressure) : null;
  const minMemAvail = memoryAvailable.length ? Math.min(...memoryAvailable) : null;
  const peakCpu = cpuNorm.length ? Math.max(...cpuNorm) : null;
  const peakSwap = swapUsed.length ? Math.max(...swapUsed) : null;
  const peakRss = pm2Rss.length ? Math.max(...pm2Rss) : null;

  let manualReviewEligible = true;

  const hasCompleteGateMetrics =
    role === 'main-app'
      ? inWindow.every(
          (r) =>
            r.memoryPressurePercent !== null &&
            r.memoryAvailableMb !== null &&
            r.cpuNormalizedPercent !== null &&
            r.swapUsedMb !== null &&
            r.pm2ApiRssMb !== null &&
            r.pm2ApiMemoryLimitMb !== null,
        )
      : inWindow.every(
          (r) =>
            r.memoryPressurePercent !== null &&
            r.memoryAvailableMb !== null &&
            r.cpuNormalizedPercent !== null &&
            r.swapUsedMb !== null,
        );

  if (!hasCompleteGateMetrics) {
    manualReviewEligible = false;
    reasons.push('Incomplete gate metrics in window; manual capacity review requires full samples.');
  }

  if (peakMemoryPressure !== null && peakMemoryPressure > thresholds.maxMemoryPressurePercent) {
    manualReviewEligible = false;
    reasons.push(
      `Peak memory pressure ${peakMemoryPressure.toFixed(1)}% exceeds ${thresholds.maxMemoryPressurePercent}%.`,
    );
  }
  if (minMemAvail !== null && minMemAvail < thresholds.minMemoryAvailableMb) {
    manualReviewEligible = false;
    reasons.push(
      `Minimum MemAvailable ${minMemAvail}MB below ${thresholds.minMemoryAvailableMb}MB.`,
    );
  }
  if (peakCpu !== null && peakCpu > thresholds.maxCpuNormalizedPercent) {
    manualReviewEligible = false;
    reasons.push(
      `Peak normalized CPU ${peakCpu.toFixed(1)}% exceeds ${thresholds.maxCpuNormalizedPercent}%.`,
    );
  }
  if (peakSwap !== null && peakSwap > thresholds.maxSwapUsedMb) {
    manualReviewEligible = false;
    reasons.push(`Swap use detected (peak ${peakSwap}MB); not treated as spare capacity.`);
  }
  if (role === 'main-app' && peakRss !== null) {
    if (peakRss > thresholds.maxPm2ApiRssMb) {
      manualReviewEligible = false;
      reasons.push(
        `Peak API RSS ${peakRss}MB exceeds ${thresholds.maxPm2ApiRssMb}MB comfort threshold.`,
      );
    }
    const headroomViolation = inWindow.some(
      (r) =>
        r.pm2ApiRssMb !== null &&
        r.pm2ApiMemoryLimitMb !== null &&
        r.pm2ApiRssMb > r.pm2ApiMemoryLimitMb - thresholds.minPm2MemoryHeadroomMb,
    );
    if (headroomViolation) {
      manualReviewEligible = false;
      reasons.push(
        `API RSS too close to PM2 limit for at least one sample; need ${thresholds.minPm2MemoryHeadroomMb}MB headroom.`,
      );
    }
  }

  let decision: CapacityDecision;
  if (manualReviewEligible && collectorErrorRows === 0) {
    decision = 'Manual review candidate';
    reasons.push(
      'All capacity gates passed for the window; manual review only (no automatic resize).',
    );
  } else if (reasons.length === 0 || (reasons.length === 1 && reasons[0].includes('collector'))) {
    decision = 'No change justified';
    reasons.push('Current sizing matches observed load; keep isolated droplets.');
  } else {
    decision = 'No change justified';
    if (!reasons.some((r) => r.includes('keep isolated'))) {
      reasons.push('Keep current droplet size and isolated n8n host.');
    }
  }

  return {
    decision,
    role: role,
    sampleCount: distinctHourCount,
    expectedSamples,
    coverageRatio,
    peakMemoryPressurePercent: peakMemoryPressure,
    p95MemoryPressurePercent: percentile(memoryPressure, 95),
    minMemoryAvailableMb: minMemAvail,
    peakCpuNormalizedPercent: peakCpu,
    peakSwapUsedMb: peakSwap,
    peakPm2ApiRssMb: peakRss,
    reasons,
    downsizingBlockedNote,
  };
}

export function formatCapacityReport(analysis: CapacityAnalysis): string {
  const lines: string[] = [];
  lines.push(`Role: ${analysis.role}`);
  lines.push(
    `Samples: ${analysis.sampleCount}/${analysis.expectedSamples} (${(analysis.coverageRatio * 100).toFixed(1)}% coverage)`,
  );
  lines.push(`Decision: ${analysis.decision}`);
  if (analysis.peakMemoryPressurePercent !== null) {
    lines.push(`Peak memory pressure: ${analysis.peakMemoryPressurePercent.toFixed(1)}%`);
  }
  if (analysis.p95MemoryPressurePercent !== null) {
    lines.push(`P95 memory pressure: ${analysis.p95MemoryPressurePercent.toFixed(1)}%`);
  }
  if (analysis.minMemoryAvailableMb !== null) {
    lines.push(`Minimum MemAvailable: ${analysis.minMemoryAvailableMb}MB`);
  }
  if (analysis.peakCpuNormalizedPercent !== null) {
    lines.push(`Peak normalized CPU: ${analysis.peakCpuNormalizedPercent.toFixed(1)}%`);
  }
  if (analysis.peakSwapUsedMb !== null) {
    lines.push(`Peak swap used: ${analysis.peakSwapUsedMb}MB`);
  }
  if (analysis.peakPm2ApiRssMb !== null) {
    lines.push(`Peak API RSS: ${analysis.peakPm2ApiRssMb}MB`);
  }
  lines.push('');
  lines.push('Reasons:');
  for (const reason of analysis.reasons) {
    lines.push(`  - ${reason}`);
  }
  lines.push('');
  lines.push(analysis.downsizingBlockedNote);
  return lines.join('\n');
}

export function loadMetricsFromDirectory(metricsDir: string, role: string): MetricRow[] {
  if (!existsSync(metricsDir)) {
    return [];
  }
  const files = readdirSync(metricsDir)
    .filter((f) => f.startsWith('metrics-') && f.endsWith('.csv'))
    .filter((f) => f.includes(`-${role}-`) || (role === 'main-app' && /^metrics-\d{4}-\d{2}\.csv$/.test(f)));

  const allRows: MetricRow[] = [];
  for (const file of files.sort()) {
    const content = readFileSync(join(metricsDir, file), 'utf8');
    allRows.push(...parseMetricsCsv(content));
  }
  return allRows;
}

function main(): void {
  const metricsDir = process.env.METRICS_DIR ?? '/var/log/performance-metrics';
  const role = process.env.METRICS_ROLE ?? 'main-app';
  const rows = loadMetricsFromDirectory(metricsDir, role);
  const analysis = analyzeCapacity(rows, role);
  console.log(formatCapacityReport(analysis));
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main();
}
