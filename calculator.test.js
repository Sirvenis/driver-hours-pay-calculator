const assert = require('assert');
const {
  calculateShift,
  calculateTotals,
  calculateBreakMinutes,
  minutesToHours,
  periodRange,
  historyRange,
  filterEntriesByHistoryRange,
  pruneEntriesToHistoryLimit,
  pruneEntriesForStorage,
  repeatShift,
  duplicateShiftNextDay,
  updateEntryById,
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

function testMultipleTimedBreaksAreSubtractedFromShiftPay() {
  const result = calculateShift({
    date: '2026-04-30',
    startTime: '06:00',
    finishTime: '18:00',
    breaks: [
      { startTime: '09:00', finishTime: '09:15' },
      { startTime: '12:00', finishTime: '12:30' },
      { startTime: '15:00', finishTime: '15:10' },
      { startTime: '17:00', finishTime: '17:05' },
    ],
    hourlyRate: 40,
  });

  assert.strictEqual(result.breakMinutes, 60);
  assert.strictEqual(result.totalMinutes, 720);
  assert.strictEqual(result.paidMinutes, 660);
  nearlyEqual(result.paidHours, 11);
  nearlyEqual(result.grossPay, 440);
}

function testTimedBreaksFallbackToLegacyBreakMinutesWhenNoBreakRowsProvided() {
  const result = calculateShift({
    date: '2026-04-30',
    startTime: '07:00',
    finishTime: '17:00',
    breakMinutes: 30,
    breaks: [],
    hourlyRate: 35,
  });

  assert.strictEqual(result.breakMinutes, 30);
  assert.strictEqual(result.paidMinutes, 570);
}

function testPaidTimedBreaksAreNotSubtractedFromShiftPay() {
  const result = calculateShift({
    date: '2026-04-30',
    startTime: '07:00',
    finishTime: '17:00',
    breaks: [
      { startTime: '09:00', finishTime: '09:15', paid: true },
      { startTime: '12:00', finishTime: '12:30', paid: false },
      { startTime: '15:00', finishTime: '15:10', paid: true },
    ],
    hourlyRate: 35,
  });

  assert.strictEqual(result.breakMinutes, 30);
  assert.strictEqual(result.paidBreakMinutes, 25);
  assert.strictEqual(result.totalBreakMinutes, 55);
  assert.strictEqual(result.totalMinutes, 600);
  assert.strictEqual(result.paidMinutes, 570);
  nearlyEqual(result.grossPay, 332.5);
}

function testTimedBreakRowsDefaultToUnpaidForBackwardCompatibility() {
  const minutes = calculateBreakMinutes([
    { startTime: '09:00', finishTime: '09:15' },
    { startTime: '12:00', finishTime: '12:30', paid: true },
  ], 0);

  assert.strictEqual(minutes, 15);
}

function testOvernightTimedBreakCanCrossMidnight() {
  const minutes = calculateBreakMinutes([
    { startTime: '23:45', finishTime: '00:15' },
    { startTime: '03:00', finishTime: '03:20' },
  ], 0);

  assert.strictEqual(minutes, 50);
}

function testIncompleteTimedBreakRowsAreIgnored() {
  const minutes = calculateBreakMinutes([
    { startTime: '09:00', finishTime: '09:15' },
    { startTime: '12:00', finishTime: '' },
    { startTime: '', finishTime: '15:10' },
  ], 0);

  assert.strictEqual(minutes, 15);
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

function testPeriodRangeWeeklyUsesSelectedDateAsPayPeriodStart() {
  const range = periodRange('2026-04-30', 'weekly');
  assert.deepStrictEqual(range, { start: '2026-04-30', end: '2026-05-06' });
}

function testPeriodRangeFortnightlyUsesSelectedDateAsPayPeriodStart() {
  const range = periodRange('2026-04-30', 'fortnightly');
  assert.deepStrictEqual(range, { start: '2026-04-30', end: '2026-05-13' });
}

function testPeriodRangeUnknownDefaultsToFortnightlyStartDate() {
  const range = periodRange('2026-04-30', 'monthly');
  assert.deepStrictEqual(range, { start: '2026-04-30', end: '2026-05-13' });
}

function testFortnightlyTotalsIncludeBothWeeksFromStartDate() {
  const entries = [
    { date: '2026-04-30', startTime: '07:00', finishTime: '15:00', breakMinutes: 30, hourlyRate: 35 },
    { date: '2026-05-06', startTime: '07:00', finishTime: '15:00', breakMinutes: 30, hourlyRate: 35 },
    { date: '2026-05-13', startTime: '07:00', finishTime: '15:00', breakMinutes: 30, hourlyRate: 35 },
    { date: '2026-05-14', startTime: '07:00', finishTime: '15:00', breakMinutes: 30, hourlyRate: 35 },
  ];
  const range = periodRange('2026-04-30', 'fortnightly');
  const selected = entries.filter((entry) => entry.date >= range.start && entry.date <= range.end);
  const totals = calculateTotals(selected);
  assert.strictEqual(totals.daysWorked, 3);
}

function testMinutesToHours() {
  nearlyEqual(minutesToHours(90), 1.5);
}

function testRepeatShiftCreatesConsecutiveCopiesWithFreshIds() {
  const repeated = repeatShift({
    id: 'original',
    date: '2026-05-01',
    startTime: '07:00',
    finishTime: '15:00',
    breaks: [{ startTime: '12:00', finishTime: '12:30', paid: false }],
    hourlyRate: 35,
    note: 'Site A',
  }, 3, (index) => `copy-${index}`);

  assert.deepStrictEqual(repeated.map((entry) => entry.date), ['2026-05-01', '2026-05-02', '2026-05-03']);
  assert.deepStrictEqual(repeated.map((entry) => entry.id), ['copy-0', 'copy-1', 'copy-2']);
  assert.strictEqual(repeated[1].startTime, '07:00');
  assert.strictEqual(repeated[1].breaks[0].finishTime, '12:30');
}

function testDuplicateShiftNextDayCopiesLastShiftAndIncrementsDate() {
  const copy = duplicateShiftNextDay({
    id: 'original',
    date: '2026-05-01',
    startTime: '07:00',
    finishTime: '15:00',
    breaks: [{ startTime: '12:00', finishTime: '12:30', paid: false }],
    hourlyRate: 35,
    note: 'Site A',
  }, () => 'next-id');

  assert.strictEqual(copy.id, 'next-id');
  assert.strictEqual(copy.date, '2026-05-02');
  assert.strictEqual(copy.startTime, '07:00');
  assert.strictEqual(copy.note, 'Site A');
  assert.deepStrictEqual(copy.breaks, [{ startTime: '12:00', finishTime: '12:30', paid: false }]);
}

function testUpdateEntryByIdReplacesOneSavedShift() {
  const entries = [
    { id: 'one', date: '2026-05-01', startTime: '07:00', finishTime: '15:00', hourlyRate: 35 },
    { id: 'two', date: '2026-05-02', startTime: '08:00', finishTime: '16:00', hourlyRate: 35 },
  ];

  const updated = updateEntryById(entries, 'two', { id: 'ignored', date: '2026-05-03', startTime: '09:00', finishTime: '17:00', hourlyRate: 40 });

  assert.deepStrictEqual(updated, [
    { id: 'one', date: '2026-05-01', startTime: '07:00', finishTime: '15:00', hourlyRate: 35 },
    { id: 'two', date: '2026-05-03', startTime: '09:00', finishTime: '17:00', hourlyRate: 40 },
  ]);
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

function testPruneEntriesForStorageKeepsFutureRepeatShifts() {
  const entries = [
    { date: '2026-04-18', startTime: '07:00', finishTime: '15:00', breakMinutes: 30, hourlyRate: 35 },
    { date: '2026-05-02', startTime: '07:00', finishTime: '15:00', breakMinutes: 30, hourlyRate: 35 },
    { date: '2026-05-03', startTime: '07:00', finishTime: '15:00', breakMinutes: 30, hourlyRate: 35 },
    { date: '2026-05-04', startTime: '07:00', finishTime: '15:00', breakMinutes: 30, hourlyRate: 35 },
    { date: '2026-05-05', startTime: '07:00', finishTime: '15:00', breakMinutes: 30, hourlyRate: 35 },
    { date: '2026-05-06', startTime: '07:00', finishTime: '15:00', breakMinutes: 30, hourlyRate: 35 },
  ];

  const pruned = pruneEntriesForStorage(entries, '2026-05-02');
  assert.deepStrictEqual(pruned.map((entry) => entry.date), ['2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05', '2026-05-06']);
}

const tests = [
  testDayShiftWithBreak,
  testOvernightShift,
  testBreakCannotMakeNegativePay,
  testMultipleTimedBreaksAreSubtractedFromShiftPay,
  testTimedBreaksFallbackToLegacyBreakMinutesWhenNoBreakRowsProvided,
  testPaidTimedBreaksAreNotSubtractedFromShiftPay,
  testTimedBreakRowsDefaultToUnpaidForBackwardCompatibility,
  testOvernightTimedBreakCanCrossMidnight,
  testIncompleteTimedBreakRowsAreIgnored,
  testTotalsForMultipleEntries,
  testPeriodRangeWeeklyUsesSelectedDateAsPayPeriodStart,
  testPeriodRangeFortnightlyUsesSelectedDateAsPayPeriodStart,
  testPeriodRangeUnknownDefaultsToFortnightlyStartDate,
  testFortnightlyTotalsIncludeBothWeeksFromStartDate,
  testMinutesToHours,
  testRepeatShiftCreatesConsecutiveCopiesWithFreshIds,
  testDuplicateShiftNextDayCopiesLastShiftAndIncrementsDate,
  testUpdateEntryByIdReplacesOneSavedShift,
  testHistoryRangeDefaultsToFourteenDaysIncludingAnchorDate,
  testFilterEntriesByHistoryRangeShowsFourteenDaysOnly,
  testPruneEntriesToFreeFourteenDayHistory,
  testPruneEntriesForStorageKeepsFutureRepeatShifts,
];

for (const test of tests) {
  test();
  console.log(`PASS ${test.name}`);
}
