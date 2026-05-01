const assert = require('assert');
const {
  calculateShift,
  calculateTotals,
  minutesToHours,
  periodRange,
  historyRange,
  filterEntriesByHistoryRange,
  pruneEntriesToHistoryLimit,
} = require('./calculator.js');

function nearlyEqual(actual, expected, tolerance = 0.001) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} to equal ${expected}`);
}

function testDayShiftWithBreak() {
  const result = calculateShift({
    date: '2026-04-30',
    startTime: '07:00',
    finishTime: '17:30',
    breakMinutes: 30,
    hourlyRate: 35,
  });

  assert.strictEqual(result.totalMinutes, 630);
  assert.strictEqual(result.paidMinutes, 600);
  nearlyEqual(result.paidHours, 10);
  nearlyEqual(result.grossPay, 350);
}

function testOvernightShift() {
  const result = calculateShift({
    date: '2026-04-30',
    startTime: '22:00',
    finishTime: '06:00',
    breakMinutes: 30,
    hourlyRate: 40,
  });

  assert.strictEqual(result.totalMinutes, 480);
  assert.strictEqual(result.paidMinutes, 450);
  nearlyEqual(result.paidHours, 7.5);
  nearlyEqual(result.grossPay, 300);
}

function testBreakCannotMakeNegativePay() {
  const result = calculateShift({
    date: '2026-04-30',
    startTime: '10:00',
    finishTime: '11:00',
    breakMinutes: 90,
    hourlyRate: 30,
  });

  assert.strictEqual(result.paidMinutes, 0);
  nearlyEqual(result.grossPay, 0);
}

function testTotalsForMultipleEntries() {
  const entries = [
    { date: '2026-04-01', startTime: '07:00', finishTime: '17:00', breakMinutes: 30, hourlyRate: 35 },
    { date: '2026-04-02', startTime: '08:00', finishTime: '16:00', breakMinutes: 30, hourlyRate: 35 },
    { date: '2026-04-03', startTime: '22:00', finishTime: '06:00', breakMinutes: 0, hourlyRate: 40 },
  ];

  const result = calculateTotals(entries);
  assert.strictEqual(result.daysWorked, 3);
  assert.strictEqual(result.totalMinutes, 1560);
  assert.strictEqual(result.paidMinutes, 1500);
  nearlyEqual(result.paidHours, 25);
  nearlyEqual(result.grossPay, 332.5 + 262.5 + 320);
}

function testPeriodRangeWeekly() {
  const range = periodRange('2026-04-30', 'weekly');
  assert.deepStrictEqual(range, { start: '2026-04-27', end: '2026-05-03' });
}

function testPeriodRangeFortnightly() {
  const range = periodRange('2026-04-30', 'fortnightly');
  assert.deepStrictEqual(range, { start: '2026-04-27', end: '2026-05-10' });
}

function testPeriodRangeMonthly() {
  const range = periodRange('2026-04-30', 'monthly');
  assert.deepStrictEqual(range, { start: '2026-04-01', end: '2026-04-30' });
}

function testMinutesToHours() {
  nearlyEqual(minutesToHours(90), 1.5);
}

function testHistoryRangeDefaultsToFourteenDaysIncludingAnchorDate() {
  const range = historyRange('2026-05-14');
  assert.deepStrictEqual(range, { start: '2026-05-01', end: '2026-05-14' });
}

function testFilterEntriesByHistoryRangeShowsFourteenDaysOnly() {
  const entries = [
    { date: '2026-04-30', startTime: '07:00', finishTime: '15:00', breakMinutes: 30, hourlyRate: 35 },
    { date: '2026-05-01', startTime: '07:00', finishTime: '15:00', breakMinutes: 30, hourlyRate: 35 },
    { date: '2026-05-08', startTime: '07:00', finishTime: '15:00', breakMinutes: 30, hourlyRate: 35 },
    { date: '2026-05-14', startTime: '07:00', finishTime: '15:00', breakMinutes: 30, hourlyRate: 35 },
    { date: '2026-05-15', startTime: '07:00', finishTime: '15:00', breakMinutes: 30, hourlyRate: 35 },
  ];

  const selected = filterEntriesByHistoryRange(entries, '2026-05-14');
  assert.deepStrictEqual(selected.map((entry) => entry.date), ['2026-05-01', '2026-05-08', '2026-05-14']);
}

function testPruneEntriesToFreeFourteenDayHistory() {
  const entries = [
    { date: '2026-04-30', startTime: '07:00', finishTime: '15:00', breakMinutes: 30, hourlyRate: 35 },
    { date: '2026-05-01', startTime: '07:00', finishTime: '15:00', breakMinutes: 30, hourlyRate: 35 },
    { date: '2026-05-14', startTime: '07:00', finishTime: '15:00', breakMinutes: 30, hourlyRate: 35 },
    { date: '2026-05-15', startTime: '07:00', finishTime: '15:00', breakMinutes: 30, hourlyRate: 35 },
  ];

  const pruned = pruneEntriesToHistoryLimit(entries, '2026-05-14');
  assert.deepStrictEqual(pruned.map((entry) => entry.date), ['2026-05-01', '2026-05-14']);
}

const tests = [
  testDayShiftWithBreak,
  testOvernightShift,
  testBreakCannotMakeNegativePay,
  testTotalsForMultipleEntries,
  testPeriodRangeWeekly,
  testPeriodRangeFortnightly,
  testPeriodRangeMonthly,
  testMinutesToHours,
  testHistoryRangeDefaultsToFourteenDaysIncludingAnchorDate,
  testFilterEntriesByHistoryRangeShowsFourteenDaysOnly,
  testPruneEntriesToFreeFourteenDayHistory,
];

for (const test of tests) {
  test();
  console.log(`PASS ${test.name}`);
}
