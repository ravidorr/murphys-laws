import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(rootDirectory, 'backend/scripts/analyze-resource-peaks.sh');

const header =
  'timestamp,role,frontend_response_ms,api_response_ms,db_query_ms,memory_used_mb,memory_available_mb,memory_pressure_percent,swap_used_mb,swap_in,swap_out,cpu_cores,cpu_load_1m,cpu_load_5m,cpu_load_15m,cpu_normalized_percent,disk_used_gb,disk_available_gb,disk_percent,db_size_mb,pm2_api_restarts,pm2_api_uptime_hours,pm2_api_rss_mb,pm2_api_memory_limit_mb,collector_errors';

function row(timestamp: string, memoryPressure: number, role = 'main-app'): string {
  return `${timestamp},${role},,,,400,500,${memoryPressure},0,0,0,1,0.5,0.4,0.3,50,10,14,49,1.6,0,1,120,512,`;
}

function addDays(date: string, days: number): string {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

// A stand-in `date` that fixes "now" (STAND_IN_NOW) and formats an instant the way the real one does: without -u it
// prints the wall-clock time of the zone in TZ (daylight saving time included, as JavaScript's Date knows it), with -u
// UTC. It understands `+%s` (now), GNU `-d @<seconds>`, BSD `-r <seconds>`, `-u`, and the %Y %m %d %H %M %S %s formats,
// and exits 2 with a message on stderr on anything else, so the script calling `date` in a new way (`date -d "1 month
// ago"`, which rolls over on Mar 29, is one) fails its test. STAND_IN_FLAVOR picks how it behaves: gnu (the default)
// takes `-d`; bsd rejects `-d` like BSD date does, so the script's `-r` fallback runs; none rejects both (a date that
// cannot format an epoch, like an old busybox's), so the script cannot work out a cutoff; fail exits 1 with no output
// on every call; empty exits 0 with no output; garbage prints something that is not a date; cutoff-only gives the UTC
// cutoff and fails the local-zone calls on an epoch (the months). STAND_IN_CUTOFF_MONTH, when set, is what the local
// `%Y-%m` of an instant before now prints. The script discards the stand-in's stderr and reports a date that gives
// nothing as its own error with exit 1, so run the stand-in by hand (STAND_IN_NOW=2026-05-15T12:00:00Z node date.mjs
// -d @1 +%s) to see which call it did not understand.
const standInDate = `
const nowMs = new Date(process.env.STAND_IN_NOW).getTime();
const fail = (message) => { console.error('date stand-in: ' + message); process.exit(2); };
const args = process.argv.slice(2);
const utc = args.includes('-u');
const flavor = process.env.STAND_IN_FLAVOR;
if (flavor === 'fail') process.exit(1);
if (flavor === 'empty') process.exit(0);
if (flavor === 'garbage') { console.log('not a date'); process.exit(0); }
let when = nowMs;
let epochGiven = false;
let format;
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  let match;
  if (arg === '-u') {
    continue;
  } else if (arg === '-d') {
    const expression = args[(index += 1)] ?? '';
    if (flavor === 'bsd' || flavor === 'none') {
      console.error('date: illegal option -- d');
      process.exit(1);
    }
    match = /^@(\\d+)$/.exec(expression);
    if (!match) fail('unsupported -d expression: ' + expression);
    when = Number(match[1]) * 1000;
    epochGiven = true;
  } else if (arg === '-r') {
    const seconds = args[(index += 1)] ?? '';
    if (flavor !== 'bsd') fail('-r is only part of the bsd flavor: ' + flavor);
    if (!/^\\d+$/.test(seconds)) fail('unsupported -r value: ' + seconds);
    when = Number(seconds) * 1000;
    epochGiven = true;
  } else if (arg.startsWith('+')) {
    format = arg.slice(1);
  } else {
    fail('unsupported argument: ' + arg);
  }
}
if (!format) fail('no format');
if (flavor === 'cutoff-only' && !utc && epochGiven) process.exit(1);
if (process.env.STAND_IN_CUTOFF_MONTH && !utc && epochGiven && when < nowMs && format === '%Y-%m') {
  console.log(process.env.STAND_IN_CUTOFF_MONTH);
  process.exit(0);
}
const instant = new Date(when);
const read = (name) => (utc ? instant['getUTC' + name]() : instant['get' + name]());
const two = (value) => String(value).padStart(2, '0');
const fields = {
  Y: String(read('FullYear')), m: two(read('Month') + 1), d: two(read('Date')),
  H: two(read('Hours')), M: two(read('Minutes')), S: two(read('Seconds')), s: String(Math.floor(when / 1000)),
};
console.log(format.replace(/%([YmdHMSs])/g, (_, field) => fields[field]));
`;

type Result = { sampleCount: number; peak: string | undefined };

type Json = {
  sampleCount: number;
  metrics: Array<{ label: string; value: string; timestamp: string }>;
  missingMetrics?: string[];
};

// A metrics file is its rows under the standard header, or its own header and rows.
type FileSpec = string[] | { header: string; rows: string[] };

type Options = {
  role?: string;
  timeZone?: string;
  bsdDate?: boolean;
  // How the stand-in `date` behaves (see its comment); bsdDate is the same as flavor 'bsd'.
  flavor?: string;
  // The days argument, appended after --format json --role <role>.
  days?: string;
  // Every argument of the script, replacing the default ones.
  args?: string[];
  // The name of the metrics directory (a name with a space tests the quoting of the file list).
  directoryName?: string;
  bash?: string;
  // What the stand-in prints as the local month of an instant before now (see its comment).
  cutoffMonth?: string;
  // Runs with the real `date` of the machine, not the stand-in.
  realDate?: boolean;
  // Extra environment variables of the run.
  env?: Record<string, string>;
  // Files (of `files`) that are made unreadable after they are written.
  unreadable?: string[];
};

type Run = { status: number | null; stdout: string; stderr: string };

// Runs the script as if it were noon UTC on `today` (YYYY-MM-DD, or a full ISO time), with the stand-in `date` first on
// the PATH (unless `realDate` is set). The zone is UTC unless a test is about the zone, so the other tests do not depend on where they run. A run
// that does not end within 20 seconds fails the test: a script that loops over its arguments forever must not hang the
// suite.
function execute(today: string, files: Record<string, FileSpec>, options: Options = {}): Run {
  const { role = 'main-app', timeZone = 'UTC', bsdDate = false, days, directoryName = 'metrics', bash = 'bash', realDate = false, cutoffMonth } = options;
  const directory = mkdtempSync(path.join(tmpdir(), 'peaks-month-'));
  try {
    const metricsDir = path.join(directory, directoryName);
    const bin = path.join(directory, 'bin');
    mkdirSync(metricsDir);
    mkdirSync(bin);

    for (const [name, spec] of Object.entries(files)) {
      const { header: fileHeader, rows } = Array.isArray(spec) ? { header, rows: spec } : spec;
      writeFileSync(path.join(metricsDir, name), `${[fileHeader, ...rows].join('\n')}\n`);
    }
    for (const name of options.unreadable ?? []) chmodSync(path.join(metricsDir, name), 0);

    writeFileSync(path.join(directory, 'date.mjs'), standInDate);
    writeFileSync(path.join(bin, 'date'), `#!/bin/sh\nexec '${process.execPath}' '${path.join(directory, 'date.mjs')}' "$@"\n`, { mode: 0o755 });

    const env = {
      ...process.env,
      METRICS_DIR: metricsDir,
      PATH: realDate ? (process.env.PATH ?? '') : `${bin}:${process.env.PATH ?? ''}`,
      TZ: timeZone,
      STAND_IN_NOW: today.length > 10 ? today : `${today}T12:00:00Z`,
      STAND_IN_FLAVOR: options.flavor ?? (bsdDate ? 'bsd' : 'gnu'),
      ...(cutoffMonth === undefined ? {} : { STAND_IN_CUTOFF_MONTH: cutoffMonth }),
      ...options.env,
    };
    const args = options.args ?? ['--format', 'json', '--role', role, ...(days === undefined ? [] : [days])];
    const run = spawnSync(bash, [script, ...args], { env, encoding: 'utf8', timeout: 20_000 });
    if (run.error) throw run.error;
    return { status: run.status, stdout: run.stdout, stderr: run.stderr };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

// A run that has to succeed with JSON on stdout. The script discards the stderr of the `date -d` that the BSD flavour
// refuses, so stderr stays empty in every flavour that works.
function runJson(today: string, files: Record<string, FileSpec>, options: Options = {}): Json {
  const run = execute(today, files, options);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stderr, '');
  return JSON.parse(run.stdout) as Json;
}

function runOn(today: string, files: Record<string, FileSpec>, options: Options = {}): Result {
  const parsed = runJson(today, files, options);
  return { sampleCount: parsed.sampleCount, peak: parsed.metrics.find((metric) => metric.label === 'Memory pressure percent')?.value };
}

// [today, month that holds the previous month's file]. Each date is at most the 30th, so the previous month's last day
// is inside the 30-day window (on the 30th, the 18:00 row is after the noon cutoff) and its file has to be read. The
// first four are days on which GNU `date -d "1 month ago"` lands in the current month because the previous month is
// too short (Mar 29 -> "Feb 29" -> Mar 1; 2028 is a leap year, so Mar 29 is fine there and Mar 30 is not; 2028-03-29
// is the leap-year control that follows them). The months 08 and 09 are there because bash reads a number with a leading zero as octal unless it is told otherwise.
const cases: Array<[string, string]> = [
  ['2026-03-29', '2026-02'],
  ['2026-03-30', '2026-02'],
  ['2027-03-29', '2027-02'],
  ['2028-03-30', '2028-02'],
  ['2028-03-29', '2028-02'],
  ['2026-05-30', '2026-04'],
  ['2026-12-30', '2026-11'],
  ['2026-09-15', '2026-08'],
  ['2026-10-15', '2026-09'],
  ['2026-08-15', '2026-07'],
  ['2026-01-30', '2025-12'],
  ['2026-01-01', '2025-12'],
  ['2026-03-01', '2026-02'],
  ['2026-11-12', '2026-10'],
];

for (const [today, previousMonth] of cases) {
  test(`on ${today} the previous month's file is ${previousMonth}`, () => {
    const lastDayOfPreviousMonth = addDays(`${today.slice(0, 7)}-01`, -1);
    const currentMonth = today.slice(0, 7);
    // The previous month's row is the highest reading of the window and sits on its last day, which is inside it. The
    // row of 99 is 31 days old, so it is outside the window and keeps an empty cutoff from passing these cases.
    const result = runOn(today, {
      [`metrics-main-app-${currentMonth}.csv`]: [row(`${currentMonth}-01T12:00:00Z`, 50)],
      [`metrics-main-app-${previousMonth}.csv`]: [row(`${addDays(today, -31)}T00:00:00Z`, 99), row(`${lastDayOfPreviousMonth}T18:00:00Z`, 90)],
    });

    assert.equal(lastDayOfPreviousMonth.slice(0, 7), previousMonth, 'the case names the right month');
    assert.deepEqual(result, { sampleCount: 2, peak: '90 %' });
  });
}

// On these days the 30-day window starts on the 1st, so only the current month's file has rows in it. It has to be read
// once: GNU `date -d "1 month ago"` gives the current month on them, and the file was listed (and counted) twice.
for (const today of ['2026-03-31', '2026-05-31', '2026-07-31', '2026-10-31', '2026-12-31']) {
  test(`on ${today} the current month's file is read once`, () => {
    const currentMonth = today.slice(0, 7);
    const previousMonth = addDays(`${currentMonth}-01`, -1).slice(0, 7);
    const result = runOn(today, {
      [`metrics-main-app-${currentMonth}.csv`]: [row(`${currentMonth}-02T12:00:00Z`, 50)],
      [`metrics-main-app-${previousMonth}.csv`]: [row(`${previousMonth}-28T12:00:00Z`, 90)],
    });

    assert.deepEqual(result, { sampleCount: 1, peak: '50 %' });
  });
}

test('the legacy metrics-YYYY-MM.csv files of the main app are read for the current and previous month, once each', () => {
  const result = runOn('2026-03-29', {
    'metrics-2026-03.csv': [row('2026-03-01T12:00:00Z', 50)],
    'metrics-2026-02.csv': [row('2026-02-28T18:00:00Z', 90)],
  });

  assert.deepEqual(result, { sampleCount: 2, peak: '90 %' });
});

test('a month before the one the window starts in is never read', () => {
  const result = runOn('2026-03-29', {
    'metrics-main-app-2026-03.csv': [row('2026-03-01T12:00:00Z', 50)],
    'metrics-main-app-2026-02.csv': [row('2026-02-28T18:00:00Z', 60)],
    // Inside the window (after the Feb 27 cutoff), so only the file name keeps it out.
    'metrics-main-app-2026-01.csv': [row('2026-02-28T19:00:00Z', 99)],
  });

  assert.deepEqual(result, { sampleCount: 2, peak: '60 %' });
});

test('the n8n role reads its own files for the current and previous month and leaves the main app files alone', () => {
  const result = runOn(
    '2026-03-29',
    {
      'metrics-n8n-2026-03.csv': [row('2026-03-01T12:00:00Z', 50, 'n8n')],
      'metrics-n8n-2026-02.csv': [row('2026-02-28T18:00:00Z', 70, 'n8n'), row('2026-02-28T19:00:00Z', 99, 'main-app')],
      'metrics-main-app-2026-03.csv': [row('2026-03-02T12:00:00Z', 98)],
      'metrics-2026-02.csv': [row('2026-02-28T20:00:00Z', 97)],
    },
    { role: 'n8n' },
  );

  assert.deepEqual(result, { sampleCount: 2, peak: '70 %' });
});

// The CSV timestamps are UTC, so the 30-day cutoff has to be 30 days before now in UTC whatever the zone of the host. A
// cutoff built from the local wall-clock time with a Z on it would move the window by the zone's offset: 14 hours later
// in Pacific/Kiritimati (UTC+14, the 20:00 row would be dropped) and 11 hours earlier in Pacific/Pago_Pago (UTC-11, the
// 06:00 row would be kept). Now is 2026-05-15 12:00 UTC, so the cutoff is 2026-04-15T12:00:00Z. Each zone runs with GNU
// and with BSD `date`, so that both ways of asking for the cutoff are covered.
for (const timeZone of ['UTC', 'Pacific/Kiritimati', 'Pacific/Pago_Pago']) {
  for (const bsdDate of [false, true]) {
    test(`the 30-day window starts at the UTC cutoff in ${timeZone} with ${bsdDate ? 'BSD' : 'GNU'} date`, () => {
      const result = runOn(
        '2026-05-15',
        {
          'metrics-main-app-2026-05.csv': [row('2026-05-01T12:00:00Z', 40)],
          'metrics-main-app-2026-04.csv': [row('2026-04-15T06:00:00Z', 95), row('2026-04-15T20:00:00Z', 60)],
        },
        { timeZone, bsdDate },
      );

      assert.deepEqual(result, { sampleCount: 2, peak: '60 %' });
    });
  }
}

// The month in a file name is the local one, because performance-tracker.sh names the file with a local `date +%Y-%m`
// while the timestamps in it are UTC. Now is 2026-04-30 12:00 UTC, which is already 1 May 02:00 in Pacific/Kiritimati,
// so the host's current month is May and its previous month April, and a row of 30 April 13:00 UTC is in the May file.
test('the files are named after the local month while the rows are dated in UTC', () => {
  const result = runOn(
    '2026-04-30',
    {
      'metrics-main-app-2026-05.csv': [row('2026-04-30T13:00:00Z', 70)],
      'metrics-main-app-2026-04.csv': [row('2026-04-29T12:00:00Z', 60)],
      'metrics-main-app-2026-03.csv': [row('2026-04-01T12:00:00Z', 99)],
    },
    { timeZone: 'Pacific/Kiritimati' },
  );

  assert.deepEqual(result, { sampleCount: 2, peak: '70 %' });
});

// ---------------------------------------------------------------------------------------------------------------------
// The window is every month between the cutoff and now, not two months.
// ---------------------------------------------------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

function timestampOf(milliseconds: number): string {
  return new Date(milliseconds).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function monthName(year: number, monthIndex: number): string {
  const date = new Date(Date.UTC(year, monthIndex, 1));
  return date.toISOString().slice(0, 7);
}

// The months from `first` to `last` (YYYY-MM), both included.
function monthsBetween(first: string, last: string): string[] {
  const months: string[] = [];
  let year = Number(first.slice(0, 4));
  let monthIndex = Number(first.slice(5)) - 1;
  for (;;) {
    const name = monthName(year, monthIndex);
    months.push(name);
    if (name === last) return months;
    monthIndex += 1;
    if (monthIndex > 11) {
      monthIndex = 0;
      year += 1;
    }
  }
}

// The files of a window of `days` days that ends at noon UTC on `today`, in a host set to UTC: a file for every month from
// two before the cutoff's month to the current one, each with a row inside the window (named after the month, the main
// app's files alternating between the role name and the legacy name), so a file that is read although it should not be
// raises the count. The files of the months the window touches hold readings of 60 %, the first of them one of 90 %,
// and every other file one of 99 %; the file of the first touched month also holds a row of 99 % an hour before the
// cutoff, which is outside the window.
function windowFixture(today: string, days: number) {
  const now = new Date(`${today}T12:00:00Z`).getTime();
  const cutoff = now - days * DAY_MS;
  const inside = timestampOf(now - HOUR_MS);
  const outside = timestampOf(cutoff - HOUR_MS);
  const current = timestampOf(now).slice(0, 7);
  const first = timestampOf(cutoff).slice(0, 7);
  const touched = monthsBetween(first, current);
  const firstOfAll = new Date(Date.UTC(Number(first.slice(0, 4)), Number(first.slice(5)) - 3, 1)).toISOString().slice(0, 7);
  const files: Record<string, string[]> = {};
  monthsBetween(firstOfAll, current).forEach((month, index) => {
    const name = index % 2 === 0 ? `metrics-main-app-${month}.csv` : `metrics-${month}.csv`;
    const pressure = !touched.includes(month) ? 99 : month === first ? 90 : 60;
    files[name] = month === first ? [row(inside, pressure), row(outside, 99)] : [row(inside, pressure)];
  });
  return { files, touched };
}

// [today, days]: windows whose first month is not the previous one, or whose start is on a month boundary. The first
// three are the start of March, where the 30-day window reaches into January (Mar 1 -> Jan 30, Mar 2 -> Jan 31; in 2028,
// a leap year, Mar 1 -> Jan 31). Then the end of March (30 days from Mar 30 start on Feb 28, from Mar 31 on Mar 1, so
// only March), a 1-day window on Mar 1 (starts on Feb 28) and a 31-day window on Jul 31 (starts on Jun 30). The rest are
// longer windows: 60 and 90 days, 90 days across the year change, and 365 days from the 12th of a month and from the
// 31st of December (13 months each).
const windowCases: Array<[string, number]> = [
  ['2026-03-01', 30],
  ['2026-03-02', 30],
  ['2028-03-01', 30],
  ['2026-03-30', 30],
  ['2026-03-31', 30],
  ['2026-07-31', 31],
  ['2026-03-01', 1],
  ['2026-05-15', 60],
  ['2026-05-15', 90],
  ['2026-01-15', 90],
  ['2026-11-12', 365],
  ['2026-12-31', 365],
];

for (const [today, days] of windowCases) {
  const { files, touched } = windowFixture(today, days);
  test(`a ${days}-day window on ${today} reads the files of ${touched.join(', ')}, each once`, () => {
    assert.deepEqual(runOn(today, files, { days: String(days) }), { sampleCount: touched.length, peak: '90 %' });
  });
}

test('a month without a file inside the window is skipped, the others are read', () => {
  const result = runOn(
    '2026-05-15',
    {
      'metrics-main-app-2026-05.csv': [row('2026-05-14T00:00:00Z', 50)],
      'metrics-main-app-2026-03.csv': [row('2026-03-20T00:00:00Z', 70)],
    },
    { days: '60' },
  );

  assert.deepEqual(result, { sampleCount: 2, peak: '70 %' });
});

test('the n8n role reads its own files for every month of the window and leaves the main app files alone', () => {
  const result = runOn(
    '2026-05-15',
    {
      'metrics-n8n-2026-05.csv': [row('2026-05-14T00:00:00Z', 50, 'n8n')],
      'metrics-n8n-2026-04.csv': [row('2026-04-14T00:00:00Z', 55, 'n8n')],
      'metrics-n8n-2026-03.csv': [row('2026-03-20T00:00:00Z', 70, 'n8n')],
      'metrics-n8n-2026-02.csv': [row('2026-02-20T00:00:00Z', 99, 'n8n')],
      'metrics-main-app-2026-03.csv': [row('2026-03-20T00:00:00Z', 98)],
      'metrics-2026-04.csv': [row('2026-04-20T00:00:00Z', 97)],
    },
    { role: 'n8n', days: '90' },
  );

  assert.deepEqual(result, { sampleCount: 4, peak: '99 %' });
});

// The file name's month is the local one, so the first file to read is the one of the local month of the cutoff instant.
// Now is 2026-03-03 08:00 UTC, so the cutoff is 2026-02-01 08:00 UTC, which is still 31 January (21:00) in
// Pacific/Pago_Pago (UTC-11): the January file holds a row inside the window (and one an hour before it), and the December
// file must stay unread although its row is dated inside the window.
test("the first month to read is the local month of the cutoff, which can be the month before the cutoff's UTC month", () => {
  const result = runOn(
    '2026-03-03T08:00:00Z',
    {
      'metrics-main-app-2026-03.csv': [row('2026-03-02T00:00:00Z', 50)],
      'metrics-main-app-2026-02.csv': [row('2026-02-10T00:00:00Z', 60)],
      'metrics-main-app-2026-01.csv': [row('2026-02-01T09:00:00Z', 80), row('2026-02-01T07:00:00Z', 99)],
      'metrics-main-app-2025-12.csv': [row('2026-02-02T00:00:00Z', 98)],
    },
    { timeZone: 'Pacific/Pago_Pago', days: '30' },
  );

  assert.deepEqual(result, { sampleCount: 3, peak: '80 %' });
});

// The same window under the bash of the machine and the system bash, which on macOS is 3.2.
for (const bash of ['bash', '/bin/bash']) {
  if (bash !== 'bash' && !existsSync(bash)) continue;
  test(`a window of several months and a metrics directory with a space in its name work under ${bash}`, () => {
    const { files, touched } = windowFixture('2026-05-15', 90);
    const result = runOn('2026-05-15', files, { days: '90', bash, directoryName: 'metrics with spaces' });
    assert.deepEqual(result, { sampleCount: touched.length, peak: '90 %' });
  });
}

test('a metrics directory with a space in its name is read in text mode, with the main app role and legacy files', () => {
  const run = execute(
    '2026-05-15',
    {
      'metrics-main-app-2026-05.csv': [row('2026-05-14T00:00:00Z', 50)],
      'metrics-2026-04.csv': [row('2026-04-20T00:00:00Z', 70)],
    },
    { args: ['45'], directoryName: 'my metrics' },
  );

  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /Source: .*my metrics\n/);
  assert.match(run.stdout, /^Memory pressure %\s+70 %\s+2026-04-20T00:00:00Z\s*$/m);
  assert.match(run.stdout, /Total records analyzed: 2\n$/);
});

// ---------------------------------------------------------------------------------------------------------------------
// The window has to be known.
// ---------------------------------------------------------------------------------------------------------------------

// Rows that would all pass the filter if the cutoff were empty: one far outside the window, one inside.
const dateFailureFiles = { 'metrics-main-app-2026-05.csv': [row('2020-01-01T00:00:00Z', 99), row('2026-05-14T00:00:00Z', 50)] };

for (const flavor of ['none', 'fail', 'empty', 'garbage']) {
  for (const format of ['json', 'text']) {
    test(`a cutoff that date cannot give (${flavor} date, ${format} output) is an error, and nothing is analysed`, () => {
      const run = execute('2026-05-15', dateFailureFiles, { flavor, args: ['--format', format, '7'] });

      assert.equal(run.status, 1);
      assert.equal(run.stdout, '', 'no result, no half a document on stdout');
      assert.match(run.stderr, /^Error: could not work out the start of the 7-day window: .*unbounded/);
    });
  }
}

test('a date that gives the cutoff but no month is an error too', () => {
  // The stand-in gives the UTC cutoff and nothing for the local-zone calls on an epoch: here, the months.
  const run = execute('2026-05-15', dateFailureFiles, { flavor: 'cutoff-only' });

  assert.equal(run.status, 1);
  assert.equal(run.stdout, '');
  assert.match(run.stderr, /could not work out the months of the 30-day window/);
});

// ---------------------------------------------------------------------------------------------------------------------
// The arguments.
// ---------------------------------------------------------------------------------------------------------------------

const someFiles = { 'metrics-main-app-2026-05.csv': [row('2026-05-15T06:00:00Z', 50)] };

for (const days of ['0', '00', '-5', 'abc', '366', '1000', '99999999999999999999', '18446744073709551617', '1.5', '1e3', '+5', '0x10']) {
  test(`the days argument ${days} is a usage error`, () => {
    const run = execute('2026-05-15', someFiles, { days });

    assert.equal(run.status, 2);
    assert.equal(run.stdout, '');
    assert.match(run.stderr, /^\d+$/.test(days) ? /^Error: days must be a whole number from 1 to 365/ : /^Error: unknown argument/);
    assert.match(run.stderr, /Usage: /);
  });
}

for (const days of ['1', '7', '365']) {
  test(`${days} is a valid number of days`, () => {
    assert.equal(runJson('2026-05-15', someFiles, { days }).sampleCount, 1);
  });
}

test('days with leading zeros are decimal, not octal', () => {
  const run = execute('2026-05-15', someFiles, { args: ['030'] });

  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /\(Last 30 days, role=main-app\)/);
  assert.match(run.stdout, /Analyzing data since: 2026-04-15T12:00:00Z/);
});

for (const args of [['--format'], ['--role'], ['--no-header', '--format'], ['7', '--role'], ['--format', ''], ['--role', '']]) {
  test(`${JSON.stringify(args)} is a usage error (a flag without its value), not an endless loop`, () => {
    const run = execute('2026-05-15', someFiles, { args });

    assert.equal(run.status, 2);
    assert.equal(run.stdout, '');
    assert.match(run.stderr, /^Error: --(format|role) needs a value/);
    assert.match(run.stderr, /Usage: /);
  });
}

for (const [args, message] of [
  [['--format', 'xml'], /--format must be text or json/],
  [['--role', '../etc'], /^Error: the role must start with a letter or a digit/],
  [['--role', '-x'], /^Error: the role must start with a letter or a digit/],
  [['--role', 'a b'], /^Error: the role must start with a letter or a digit/],
  [['--frobnicate'], /unknown argument '--frobnicate'/],
] as Array<[string[], RegExp]>) {
  test(`${JSON.stringify(args)} is a usage error`, () => {
    const run = execute('2026-05-15', someFiles, { args });

    assert.equal(run.status, 2);
    assert.equal(run.stdout, '');
    assert.match(run.stderr, message);
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// A reading that is missing is never a blank peak.
// ---------------------------------------------------------------------------------------------------------------------

const columns = header.split(',');
const defaults: Record<string, string | number> = {
  role: 'main-app',
  memory_available_mb: 500,
  memory_pressure_percent: 50,
  swap_used_mb: 0,
  cpu_cores: 1,
  cpu_load_1m: 0.5,
  cpu_normalized_percent: 50,
  disk_percent: 49,
  pm2_api_rss_mb: 120,
};

function csvRow(timestamp: string, values: Record<string, string | number> = {}): string {
  const merged: Record<string, string | number> = { timestamp, ...defaults, ...values };
  return columns.map((column) => String(merged[column] ?? '')).join(',');
}

const all = ['Memory pressure percent', 'Min MemAvailable MB', 'Swap used MB', 'CPU normalized percent', 'Disk percent', 'API RSS MB'];

// Every metric the script reports has a number, its unit and a UTC timestamp, whatever the input was.
function assertNoBlankPeak(parsed: Json): void {
  for (const metric of parsed.metrics) {
    assert.match(metric.value, /^\d+(\.\d+)? (%|MB)$/, `${metric.label} has a blank or odd value`);
    assert.match(metric.timestamp, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/, `${metric.label} has a blank or odd timestamp`);
  }
}

const sampleTime = '2026-05-10T00:00:00Z';

test('the JSON for data with a positive peak in every metric has the same shape as before: no extra field, the first timestamp of a tie', () => {
  const run = execute(
    '2026-05-15',
    {
      'metrics-main-app-2026-05.csv': [
        csvRow('2026-05-10T00:00:00Z', { memory_pressure_percent: 60, memory_available_mb: 300, swap_used_mb: 5, cpu_normalized_percent: 70, disk_percent: 50, pm2_api_rss_mb: 100 }),
        csvRow('2026-05-11T00:00:00Z', { memory_pressure_percent: 40, memory_available_mb: 200, swap_used_mb: 5, cpu_normalized_percent: 20, disk_percent: 55, pm2_api_rss_mb: 130 }),
      ],
    },
    {},
  );

  assert.equal(run.status, 0, run.stderr);
  assert.equal(
    run.stdout,
    '{"sampleCount":2,"metrics":[' +
      '{"label":"Memory pressure percent","value":"60 %","timestamp":"2026-05-10T00:00:00Z"},' +
      '{"label":"Min MemAvailable MB","value":"200 MB","timestamp":"2026-05-11T00:00:00Z"},' +
      '{"label":"Swap used MB","value":"5 MB","timestamp":"2026-05-10T00:00:00Z"},' +
      '{"label":"CPU normalized percent","value":"70 %","timestamp":"2026-05-10T00:00:00Z"},' +
      '{"label":"Disk percent","value":"55 %","timestamp":"2026-05-11T00:00:00Z"},' +
      '{"label":"API RSS MB","value":"130 MB","timestamp":"2026-05-11T00:00:00Z"}]}\n',
  );
});

test('a metric that is 0 in every row is reported as 0 with a timestamp, not as a blank', () => {
  const parsed = runJson('2026-05-15', { 'metrics-main-app-2026-05.csv': [csvRow(sampleTime, { cpu_normalized_percent: 0 })] });

  assertNoBlankPeak(parsed);
  assert.deepEqual(parsed.metrics.find((metric) => metric.label === 'Swap used MB'), { label: 'Swap used MB', value: '0 MB', timestamp: sampleTime });
  assert.deepEqual(parsed.metrics.find((metric) => metric.label === 'CPU normalized percent'), { label: 'CPU normalized percent', value: '0 %', timestamp: sampleTime });
  assert.equal(parsed.missingMetrics, undefined);
});

test('a header without most of the columns leaves those metrics out of the list and names them', () => {
  const parsed = runJson('2026-05-15', {
    'metrics-main-app-2026-05.csv': { header: 'timestamp,role,memory_available_mb', rows: [`${sampleTime},main-app,500`] },
  });

  assertNoBlankPeak(parsed);
  assert.deepEqual(parsed.metrics, [{ label: 'Min MemAvailable MB', value: '500 MB', timestamp: sampleTime }]);
  assert.deepEqual(parsed.missingMetrics, all.filter((label) => label !== 'Min MemAvailable MB'));
});

test('a row shorter than the header leaves the columns it does not reach out of the list', () => {
  const parsed = runJson('2026-05-15', {
    'metrics-main-app-2026-05.csv': [`${sampleTime},main-app,,,,400,500,60`],
  });

  assertNoBlankPeak(parsed);
  assert.deepEqual(
    parsed.metrics.map((metric) => [metric.label, metric.value]),
    [
      ['Memory pressure percent', '60 %'],
      ['Min MemAvailable MB', '500 MB'],
    ],
  );
  assert.deepEqual(parsed.missingMetrics, ['Swap used MB', 'CPU normalized percent', 'Disk percent', 'API RSS MB']);
});

test('a reading that is empty, negative or not a number is a missing reading, not a 0', () => {
  const parsed = runJson('2026-05-15', {
    'metrics-main-app-2026-05.csv': [csvRow(sampleTime, { memory_pressure_percent: 'abc', disk_percent: '', pm2_api_rss_mb: '-3', swap_used_mb: '1e3' })],
  });

  assertNoBlankPeak(parsed);
  assert.deepEqual(parsed.missingMetrics, ['Memory pressure percent', 'Swap used MB', 'Disk percent', 'API RSS MB']);
});

test('a blank CPU column is not a CPU of 0: the load over the cores is used when it can be, otherwise the metric is missing', () => {
  const fallback = runJson('2026-05-15', {
    'metrics-main-app-2026-05.csv': [csvRow(sampleTime, { cpu_normalized_percent: '', cpu_load_1m: 2, cpu_cores: 4 })],
  });
  assert.deepEqual(fallback.metrics.find((metric) => metric.label === 'CPU normalized percent'), {
    label: 'CPU normalized percent',
    value: '50 %',
    timestamp: sampleTime,
  });

  for (const values of [{ cpu_load_1m: '' }, { cpu_cores: '' }, { cpu_cores: 0 }]) {
    const parsed = runJson('2026-05-15', {
      'metrics-main-app-2026-05.csv': [csvRow(sampleTime, { cpu_normalized_percent: '', cpu_load_1m: 2, cpu_cores: 4, ...values })],
    });
    assertNoBlankPeak(parsed);
    assert.deepEqual(parsed.missingMetrics, ['CPU normalized percent'], JSON.stringify(values));
  }
});

test('rows whose timestamp is not a UTC timestamp are not counted', () => {
  const parsed = runJson('2026-05-15', {
    'metrics-main-app-2026-05.csv': [
      csvRow('garbage'),
      csvRow(''),
      csvRow('2026-05-12 00:00:00'),
      csvRow('2026-05-12T00:00:00'),
      csvRow('zzzz'),
      csvRow(sampleTime),
    ],
  });

  assert.equal(parsed.sampleCount, 1);
});

test('the text output shows a missing reading as n/a and the others as before', () => {
  const run = execute('2026-05-15', { 'metrics-main-app-2026-05.csv': [`${sampleTime},main-app,,,,400,500,60`] }, { args: ['--no-header'] });

  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^Memory pressure %\s+60 %\s+2026-05-10T00:00:00Z\s*$/m);
  assert.match(run.stdout, /^Min MemAvailable MB\s+500 MB\s+2026-05-10T00:00:00Z\s*$/m);
  for (const label of ['Swap used MB', 'CPU normalized %', 'Disk %', 'API RSS MB']) {
    assert.match(run.stdout, new RegExp(`^${label}\\s+n/a\\s+-\\s*$`, 'm'));
  }
  assert.doesNotMatch(run.stdout, /^(Swap used MB|CPU normalized %|Disk %|API RSS MB)\s+(MB|%)/m);
  assert.match(run.stdout, /Total records analyzed: 1\n$/);
});

// ---------------------------------------------------------------------------------------------------------------------
// The real `date` of the machine the tests run on (BSD on macOS, GNU on Linux).
// ---------------------------------------------------------------------------------------------------------------------

// The month of an instant in a zone, as a file of that zone's host is named.
function localMonth(milliseconds: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit' }).formatToParts(new Date(milliseconds));
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value;
  return `${part('year')}-${part('month')}`;
}

for (const timeZone of ['UTC', 'Pacific/Kiritimati', 'Pacific/Pago_Pago']) {
  for (const days of [30, 120, 365]) {
    test(`the real date gives the window of ${days} days in ${timeZone}: every month from the cutoff's is read`, () => {
      const now = Date.now();
      const cutoff = now - days * DAY_MS;
      const touched = monthsBetween(localMonth(cutoff, timeZone), localMonth(now, timeZone));
      // Every file holds a row inside the window, the first one of them two hours after the cutoff (the run is far
      // shorter) and, outside it, one two hours before; the file of the month before the first has a row inside the
      // window too, which must stay unread.
      const before = monthName(Number(touched[0].slice(0, 4)), Number(touched[0].slice(5)) - 2);
      const files: Record<string, string[]> = { [`metrics-main-app-${before}.csv`]: [row(timestampOf(now - HOUR_MS), 99)] };
      touched.forEach((month, index) => {
        files[`metrics-main-app-${month}.csv`] = index === 0 ? [row(timestampOf(cutoff + 2 * HOUR_MS), 90), row(timestampOf(cutoff - 2 * HOUR_MS), 99)] : [row(timestampOf(now - HOUR_MS), 60)];
      });
      const run = execute('unused', files, { timeZone, days: String(days), realDate: true });

      assert.equal(run.status, 0, run.stderr);
      assert.equal(run.stderr, '');
      const parsed = JSON.parse(run.stdout) as Json;
      assert.equal(parsed.sampleCount, touched.length);
      assert.equal(parsed.metrics.find((metric) => metric.label === 'Memory pressure percent')?.value, '90 %');
    });
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// More edges of the window, the files and the readings.
// ---------------------------------------------------------------------------------------------------------------------

// The cutoff and the first month come from the same instant, 40 days of exactly 24 hours back, also when the clocks
// change inside the window. Now is 2026-04-10 04:30 UTC and daylight saving time started in America/New_York on 8 March,
// so the cutoff is 2026-03-01 04:30 UTC, which is 28 February 23:30 there: the February file holds rows of the window.
// (Taking 40 calendar days off the local time gives 1 March 04:30 EST, and the first month would be March.)
test('the first month is the local month of the cutoff instant also when daylight saving time starts inside the window', () => {
  const result = runOn(
    '2026-04-10T04:30:00Z',
    {
      'metrics-main-app-2026-04.csv': [row('2026-04-09T00:00:00Z', 50)],
      'metrics-main-app-2026-03.csv': [row('2026-03-20T00:00:00Z', 60)],
      'metrics-main-app-2026-02.csv': [row('2026-03-01T04:45:00Z', 90)],
    },
    { timeZone: 'America/New_York', days: '40' },
  );

  assert.deepEqual(result, { sampleCount: 3, peak: '90 %' });
});

test('a row exactly at the cutoff is in the window and one second before it is not', () => {
  // Now is 2026-05-15 12:00 UTC, so the cutoff is 2026-04-15T12:00:00Z.
  const result = runOn('2026-05-15', {
    'metrics-main-app-2026-05.csv': [row('2026-05-01T00:00:00Z', 50)],
    'metrics-main-app-2026-04.csv': [row('2026-04-15T12:00:00Z', 70), row('2026-04-15T11:59:59Z', 99)],
  });

  assert.deepEqual(result, { sampleCount: 2, peak: '70 %' });
});

test('a tie between two months names the timestamp of the newest month', () => {
  const parsed = runJson('2026-05-15', {
    'metrics-main-app-2026-05.csv': [row('2026-05-10T00:00:00Z', 60)],
    'metrics-main-app-2026-04.csv': [row('2026-04-20T00:00:00Z', 60)],
  });

  assert.deepEqual(parsed.metrics.find((metric) => metric.label === 'Memory pressure percent'), {
    label: 'Memory pressure percent',
    value: '60 %',
    timestamp: '2026-05-10T00:00:00Z',
  });
});

test('a window with no row in it is an empty result with exit status 0, in JSON and in text', () => {
  const files = { 'metrics-main-app-2026-05.csv': [row('2026-01-01T00:00:00Z', 99)] };

  const json = execute('2026-05-15', files, {});
  assert.equal(json.status, 0, json.stderr);
  assert.equal(json.stdout, '{"sampleCount":0,"metrics":[]}\n');

  const text = execute('2026-05-15', files, { args: ['--no-header'] });
  assert.equal(text.status, 0, text.stderr);
  assert.match(text.stdout, /No data records found within the specified date range\.\n$/);
});

test('when no metric has a reading, the JSON lists none and names all six', () => {
  const run = execute('2026-05-15', { 'metrics-main-app-2026-05.csv': { header: 'timestamp,role', rows: [`${sampleTime},main-app`] } });

  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout, `{"sampleCount":1,"metrics":[],"missingMetrics":[${all.map((label) => `"${label}"`).join(',')}]}\n`);
});

test('decimal readings are kept as they are (awk prints six significant digits)', () => {
  const parsed = runJson('2026-05-15', {
    'metrics-main-app-2026-05.csv': [
      csvRow(sampleTime, {
        memory_pressure_percent: 63.4,
        memory_available_mb: 12345.678,
        cpu_normalized_percent: 12.5,
        disk_percent: 49.9,
        pm2_api_rss_mb: 120.25,
      }),
    ],
  });

  assert.deepEqual(
    parsed.metrics.map((metric) => [metric.label, metric.value]),
    [
      ['Memory pressure percent', '63.4 %'],
      ['Min MemAvailable MB', '12345.7 MB'],
      ['Swap used MB', '0 MB'],
      ['CPU normalized percent', '12.5 %'],
      ['Disk percent', '49.9 %'],
      ['API RSS MB', '120.25 MB'],
    ],
  );
});

test('a legacy file without a role column counts every row, with memory_percent as the pressure and the load over the cores', () => {
  const parsed = runJson('2026-05-15', {
    'metrics-2026-05.csv': {
      header: 'timestamp,memory_percent,swap_used_mb,cpu_load_1m,cpu_cores,disk_percent',
      rows: [`${sampleTime},63,0,2,4,50`, '2026-05-11T00:00:00Z,40,0,1,4,55'],
    },
  });

  assert.equal(parsed.sampleCount, 2);
  assert.deepEqual(
    parsed.metrics.map((metric) => [metric.label, metric.value]),
    [
      ['Memory pressure percent', '63 %'],
      ['Swap used MB', '0 MB'],
      ['CPU normalized percent', '50 %'],
      ['Disk percent', '55 %'],
    ],
  );
  assert.deepEqual(parsed.missingMetrics, ['Min MemAvailable MB', 'API RSS MB']);
});

test('a file with CRLF line endings is read like one without', () => {
  const parsed = runJson('2026-05-15', {
    'metrics-main-app-2026-05.csv': { header: 'timestamp,role,pm2_api_rss_mb\r', rows: [`${sampleTime},main-app,120\r`] },
  });

  assert.deepEqual(parsed.metrics, [{ label: 'API RSS MB', value: '120 MB', timestamp: sampleTime }]);
});

// ---------------------------------------------------------------------------------------------------------------------
// The errors leave a message on stderr, an exit status of 1 and nothing on stdout.
// ---------------------------------------------------------------------------------------------------------------------

test('no metrics file in the months of the window is an error that names the months', () => {
  const run = execute('2026-05-15', { 'metrics-main-app-2026-02.csv': [row('2026-05-14T00:00:00Z', 50)] });

  assert.equal(run.status, 1);
  assert.equal(run.stdout, '');
  assert.match(run.stderr, /^Error: No metrics files found for role main-app in .*metrics \(months 2026-04 to 2026-05\)\.\n$/);
});

test('a metrics directory that does not exist is an error', () => {
  const run = spawnSync('bash', [script, '--format', 'json'], {
    env: { ...process.env, METRICS_DIR: path.join(tmpdir(), 'peaks-month-does-not-exist') },
    encoding: 'utf8',
    timeout: 20_000,
  });

  assert.equal(run.status, 1);
  assert.equal(run.stdout, '');
  assert.match(run.stderr, /^Error: Metrics directory .*peaks-month-does-not-exist not found\.\n$/);
});

// root reads any file, so a file that cannot be read cannot be made.
test('a file that exists but cannot be read is an error before anything is printed', { skip: process.getuid?.() === 0 }, () => {
  for (const args of [['--format', 'json', '60'], ['60']]) {
    const run = execute(
      '2026-05-15',
      {
        'metrics-main-app-2026-05.csv': [row('2026-05-14T00:00:00Z', 50)],
        'metrics-main-app-2026-04.csv': [row('2026-04-20T00:00:00Z', 60)],
      },
      { args, unreadable: ['metrics-main-app-2026-04.csv'] },
    );

    assert.equal(run.status, 1, run.stderr);
    assert.equal(run.stdout, '', 'no banner and no half a table');
    assert.match(run.stderr, /^Error: cannot read .*metrics-main-app-2026-04\.csv\n$/);
  }
});

// The first month is a month the loop cannot reach the current one from: a month far back (more than the 14 the longest
// window can need) and one after the current month.
for (const cutoffMonth of ['1990-01', '2099-01']) {
  test(`a first month of ${cutoffMonth} cannot be walked to the current month and is an error`, () => {
    const run = execute('2026-05-15', dateFailureFiles, { cutoffMonth });

    assert.equal(run.status, 1);
    assert.equal(run.stdout, '');
    assert.match(run.stderr, new RegExp(`^Error: could not list the months from ${cutoffMonth} to 2026-05\\n$`));
  });
}

test('the days given twice are a usage error, not the last one silently', () => {
  const run = execute('2026-05-15', someFiles, { args: ['7', '30'] });

  assert.equal(run.status, 2);
  assert.equal(run.stdout, '');
  assert.match(run.stderr, /^Error: days given twice \('7' and '30'\)/);
});

test('the role from the environment is held to the same rule as the --role flag', () => {
  const run = execute('2026-05-15', someFiles, { args: ['--format', 'json'], env: { METRICS_ROLE: 'a/b' } });

  assert.equal(run.status, 2);
  assert.equal(run.stdout, '');
  assert.match(run.stderr, /^Error: the role must start with a letter or a digit and go on with letters, digits, - or _, got 'a\/b'/);
});

test('a DAYS_ARGUMENT variable in the environment is not taken for the days argument', () => {
  const run = execute('2026-05-15', someFiles, { args: ['--format', 'json'], env: { DAYS_ARGUMENT: '7' } });

  assert.equal(run.status, 0, run.stderr);
  assert.equal((JSON.parse(run.stdout) as Json).sampleCount, 1);
});
