import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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

// A stand-in `date` that fixes "now" and does relative arithmetic the way GNU date does, including the roll-over that
// causes the bug: a month taken off a day that does not exist in the earlier month lands in the following month (Mar 29
// minus one month is "Feb 29", which is Mar 1). JavaScript's Date normalises the same way. Without -u it reads and
// prints the wall-clock time of the zone in TZ, with -u UTC, like the real one. It understands `-d "<n> day(s)"`,
// `-d "<n> month(s) [ago]"` (the month forms exist to reproduce the old bug if it is ever reintroduced), BSD `-v-<n>d`
// and `-v-<n>m`, `-u`, and the %Y %m %d %H %M %S formats. With STAND_IN_FLAVOR=bsd it rejects `-d` like BSD date does, so
// the script's `-v` fallback runs. It exits 2 with a message on stderr on anything else, and runOn fails the test on any
// stderr output, because the script itself would swallow the exit status; a new way of asking `date` for the time needs
// one line here.
const standInDate = `
const now = new Date(process.env.STAND_IN_NOW);
const fail = (message) => { console.error('date stand-in: ' + message); process.exit(2); };
const args = process.argv.slice(2);
const utc = args.includes('-u');
if (process.env.STAND_IN_FLAVOR === 'bsd' && args.includes('-d')) {
  console.error('date: illegal option -- d');
  process.exit(1);
}
const read = (name) => (utc ? now['getUTC' + name]() : now['get' + name]());
const write = (name, value) => (utc ? now['setUTC' + name](value) : now['set' + name](value));
let format;
const shift = (count, unit) => {
  if (unit === 'month') write('Month', read('Month') + count);
  else write('Date', read('Date') + count);
};
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  let match;
  if (arg === '-u') {
    continue;
  } else if (arg === '-d') {
    const expression = args[(index += 1)] ?? '';
    match = /^([+-]?\\d+) (day|month)s?( ago)?$/.exec(expression);
    if (!match) fail('unsupported -d expression: ' + expression);
    shift((match[3] ? -1 : 1) * Number(match[1]), match[2]);
  } else if ((match = /^-v([+-]?\\d+)([dm])$/.exec(arg))) {
    shift(Number(match[1]), match[2] === 'm' ? 'month' : 'day');
  } else if (arg.startsWith('+')) {
    format = arg.slice(1);
  } else {
    fail('unsupported argument: ' + arg);
  }
}
if (!format) fail('no format');
const two = (value) => String(value).padStart(2, '0');
const fields = {
  Y: String(read('FullYear')), m: two(read('Month') + 1), d: two(read('Date')),
  H: two(read('Hours')), M: two(read('Minutes')), S: two(read('Seconds')),
};
console.log(format.replace(/%([YmdHMS])/g, (_, field) => fields[field]));
`;

type Result = { sampleCount: number; peak: string | undefined };

type Options = { role?: string; timeZone?: string; bsdDate?: boolean };

// Runs the script as if it were noon UTC on `today` (YYYY-MM-DD), with the stand-in `date` first on the PATH. The zone is
// UTC unless a test is about the zone, so the other tests do not depend on where they run. `bsdDate` makes the stand-in
// refuse `-d`, as BSD date does. The run has to leave nothing on stderr, which is where the stand-in reports a call it
// does not understand.
function runOn(today: string, files: Record<string, string[]>, { role = 'main-app', timeZone = 'UTC', bsdDate = false }: Options = {}): Result {
  const directory = mkdtempSync(path.join(tmpdir(), 'peaks-month-'));
  try {
    const metricsDir = path.join(directory, 'metrics');
    const bin = path.join(directory, 'bin');
    mkdirSync(metricsDir);
    mkdirSync(bin);

    for (const [name, rows] of Object.entries(files)) {
      writeFileSync(path.join(metricsDir, name), `${[header, ...rows].join('\n')}\n`);
    }

    writeFileSync(path.join(directory, 'date.mjs'), standInDate);
    writeFileSync(path.join(bin, 'date'), `#!/bin/sh\nexec '${process.execPath}' '${path.join(directory, 'date.mjs')}' "$@"\n`, { mode: 0o755 });

    const env = {
      ...process.env,
      METRICS_DIR: metricsDir,
      PATH: `${bin}:${process.env.PATH ?? ''}`,
      TZ: timeZone,
      STAND_IN_NOW: `${today}T12:00:00Z`,
      STAND_IN_FLAVOR: bsdDate ? 'bsd' : 'gnu',
    };
    const run = spawnSync('bash', [script, '--format', 'json', '--role', role], { env, encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    // The script hides the error of the `date -d` that the BSD flavour refuses, so stderr stays empty in both flavours.
    assert.equal(run.stderr, '');
    const parsed = JSON.parse(run.stdout) as { sampleCount: number; metrics: Array<{ label: string; value: string }> };
    return { sampleCount: parsed.sampleCount, peak: parsed.metrics.find((metric) => metric.label === 'Memory pressure percent')?.value };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
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

test('a month before the previous one is never read', () => {
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
