const assert = require('assert');
const { buildTimesheetText, buildTimesheetCsv, formatTimesheetBreaks } = require('./timesheet.js');

function testFormatTimesheetBreaksShowsPaidAndUnpaidDurations() {
  const text = formatTimesheetBreaks([
    { startTime: '09:00', finishTime: '09:15', paid: true },
    { startTime: '12:00', finishTime: '12:30', paid: false },
  ]);

  assert.strictEqual(text, '09:00-09:15 paid 15m; 12:00-12:30 unpaid 30m');
}

function testBuildTimesheetTextIncludesPeriodRowsAndTotals() {
  const text = buildTimesheetText({
    range: { start: '2026-05-02', end: '2026-05-15' },
    workerName: 'Andrew',
    employer: 'Pay Office',
    entries: [
      {
        date: '2026-05-02',
        startTime: '07:00',
        finishTime: '17:00',
        hourlyRate: 35,
        breaks: [
          { startTime: '09:00', finishTime: '09:15', paid: true },
          { startTime: '12:00', finishTime: '12:30', paid: false },
        ],
        note: 'Day shift',
      },
    ],
  });

  assert.ok(text.includes('WageCheck AU Timesheet'));
  assert.ok(text.includes('Pay period: 2026-05-02 to 2026-05-15'));
  assert.ok(text.includes('Worker: Andrew'));
  assert.ok(text.includes('2026-05-02 | 07:00-17:00'));
  assert.ok(text.includes('09:00-09:15 paid 15m; 12:00-12:30 unpaid 30m'));
  assert.ok(text.includes('Paid: 9.50h'));
  assert.ok(text.includes('Gross estimate: $332.50'));
  assert.ok(text.includes('Total paid hours: 9.50h'));
}

function testBuildTimesheetCsvEscapesNotesAndIncludesRows() {
  const csv = buildTimesheetCsv({
    range: { start: '2026-05-02', end: '2026-05-15' },
    workerName: 'Andrew',
    employer: 'Pay Office',
    entries: [
      {
        date: '2026-05-02',
        startTime: '07:00',
        finishTime: '17:00',
        hourlyRate: 35,
        breaks: [{ startTime: '12:00', finishTime: '12:30', paid: false }],
        note: 'Site A, dock 4',
      },
    ],
  });

  assert.ok(csv.includes('Date,Start,Finish,Breaks,Unpaid break minutes,Paid break minutes,Paid hours,Gross estimate,Note'));
  assert.ok(csv.includes('2026-05-02,07:00,17:00,12:00-12:30 unpaid 30m,30,0,9.50,332.50,"Site A, dock 4"'));
}

const tests = [
  testFormatTimesheetBreaksShowsPaidAndUnpaidDurations,
  testBuildTimesheetTextIncludesPeriodRowsAndTotals,
  testBuildTimesheetCsvEscapesNotesAndIncludesRows,
];

for (const test of tests) {
  test();
  console.log(`PASS ${test.name}`);
}
