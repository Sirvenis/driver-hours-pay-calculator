const assert = require('assert');
const weeklyTable = require('./data/payg-weekly-2024.json');
const fortnightlyTable = require('./data/payg-fortnightly-2024.json');
const {
  lookupPaygWithholding,
  calculateNetPayEstimate,
} = require('./payg.js');

function testWeeklyPaygUsesTaxFreeThresholdColumn() {
  const result = lookupPaygWithholding(weeklyTable, 500, true);
  assert.deepStrictEqual(result, {
    period: 'weekly',
    earnings: 500,
    tableEarnings: 500,
    taxFreeThreshold: true,
    withholding: 22,
  });
}

function testWeeklyPaygUsesNoTaxFreeThresholdColumn() {
  const result = lookupPaygWithholding(weeklyTable, 500, false);
  assert.strictEqual(result.withholding, 95);
}

function testFortnightlyPaygUsesNearestLowerEarningsAmount() {
  const result = lookupPaygWithholding(fortnightlyTable, 2001, true);
  assert.strictEqual(result.tableEarnings, 2000);
  assert.strictEqual(result.withholding, 286);
}

function testNetPayEstimateSubtractsWithholdingFromGrossPay() {
  const result = calculateNetPayEstimate(fortnightlyTable, 2001, false);
  assert.deepStrictEqual(result, {
    period: 'fortnightly',
    earnings: 2001,
    tableEarnings: 2000,
    taxFreeThreshold: false,
    withholding: 510,
    netPay: 1491,
  });
}

function testPaygReturnsZeroForZeroOrNegativeEarnings() {
  const result = lookupPaygWithholding(weeklyTable, 0, true);
  assert.strictEqual(result.tableEarnings, 0);
  assert.strictEqual(result.withholding, 0);
}

const tests = [
  testWeeklyPaygUsesTaxFreeThresholdColumn,
  testWeeklyPaygUsesNoTaxFreeThresholdColumn,
  testFortnightlyPaygUsesNearestLowerEarningsAmount,
  testNetPayEstimateSubtractsWithholdingFromGrossPay,
  testPaygReturnsZeroForZeroOrNegativeEarnings,
];

for (const test of tests) {
  test();
  console.log(`PASS ${test.name}`);
}
