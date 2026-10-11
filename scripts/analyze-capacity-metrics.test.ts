import assert from 'node:assert/strict';
import test from 'node:test';

import {
  analyzeCapacity,
  DEFAULT_THRESHOLDS,
  formatCapacityReport,
  parseMetricsCsv,
  type MetricRow,
} from '../backend/scripts/analyze-capacity-metrics.ts';

function buildRow(partial: Partial<MetricRow> & Pick<MetricRow, 'timestamp'>): MetricRow {
  return {
    role: 'main-app',
    memoryAvailableMb: 400,
    memoryPressurePercent: 40,
    swapUsedMb: 0,
    cpuNormalizedPercent: 20,
    pm2ApiRssMb: 200,
    pm2ApiMemoryLimitMb: 500,
    collectorErrors: '',
    ...partial,
  };
}

function hourlyRows(days: number, now: Date): MetricRow[] {
  const rows: MetricRow[] = [];
  for (let h = 0; h < days * 24; h++) {
    const t = new Date(now.getTime() - h * 60 * 60 * 1000);
    rows.push(
      buildRow({
        timestamp: t.toISOString().replace(/\.\d{3}Z$/, 'Z'),
      }),
    );
  }
  return rows;
}

test('parseMetricsCsv maps legacy memory_percent to pressure', () => {
  const csv = [
    'timestamp,frontend_response_ms,api_response_ms,db_query_ms,memory_used_mb,memory_available_mb,memory_percent,cpu_load_1m,cpu_load_5m,cpu_load_15m,disk_used_gb,disk_available_gb,disk_percent,db_size_mb,pm2_api_restarts,pm2_frontend_restarts,pm2_api_uptime_hours,pm2_frontend_uptime_hours',
    '2026-01-01T00:00:00Z,100,50,10,400,600,40,0.5,0.4,0.3,5,20,20,1,0,0,1,0',
  ].join('\n');
  const rows = parseMetricsCsv(csv);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].role, 'main-app');
  assert.equal(rows[0].memoryPressurePercent, 40);
});

test('analyzeCapacity returns Collecting baseline with incomplete history', () => {
  const now = new Date('2026-02-01T12:00:00Z');
  const rows = hourlyRows(5, now);
  const analysis = analyzeCapacity(rows, 'main-app', DEFAULT_THRESHOLDS, now);
  assert.equal(analysis.decision, 'Collecting baseline');
  assert.match(formatCapacityReport(analysis), /Collecting baseline/);
});

test('analyzeCapacity blocks manual review when swap is used', () => {
  const now = new Date('2026-02-01T12:00:00Z');
  const rows = hourlyRows(30, now).map((row, index) =>
    index === 10 ? buildRow({ ...row, swapUsedMb: 128 }) : row,
  );
  const analysis = analyzeCapacity(rows, 'main-app', DEFAULT_THRESHOLDS, now);
  assert.equal(analysis.decision, 'No change justified');
  assert.ok(analysis.reasons.some((r) => r.includes('Swap')));
});

test('analyzeCapacity rejects manual review when gate metrics are incomplete', () => {
  const now = new Date('2026-02-01T12:00:00Z');
  const rows = hourlyRows(30, now).map((row) =>
    buildRow({ ...row, swapUsedMb: null, pm2ApiRssMb: null }),
  );
  const analysis = analyzeCapacity(rows, 'main-app', DEFAULT_THRESHOLDS, now);
  assert.notEqual(analysis.decision, 'Manual review candidate');
  assert.ok(analysis.reasons.some((r) => r.includes('Incomplete gate metrics')));
});

test('analyzeCapacity uses distinct hourly buckets for coverage', () => {
  const now = new Date('2026-02-01T12:00:00Z');
  const base = hourlyRows(15, now);
  const duplicated = [...base, ...base];
  const analysis = analyzeCapacity(duplicated, 'main-app', DEFAULT_THRESHOLDS, now);
  assert.equal(analysis.decision, 'Collecting baseline');
});

test('analyzeCapacity can reach Manual review candidate when gates pass', () => {
  const now = new Date('2026-02-01T12:00:00Z');
  const rows = hourlyRows(30, now);
  const analysis = analyzeCapacity(rows, 'main-app', DEFAULT_THRESHOLDS, now);
  assert.equal(analysis.decision, 'Manual review candidate');
  const report = formatCapacityReport(analysis);
  assert.match(report, /512MB droplets remain blocked/);
  assert.doesNotMatch(report, /Consolidate Droplets/i);
});
