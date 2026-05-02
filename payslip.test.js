const assert = require('assert');
const { estimateSuper, comparePayslip } = require('./payslip.js');

function nearlyEqual(actual, expected, tolerance = 0.001) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} to equal ${expected}`);
}

function testEstimateSuperDefaultsToTwelvePercent() {
  nearlyEqual(estimateSuper(1500), 180);
}

function testComparePayslipShowsActualMinusExpectedDifferences() {
  const result = comparePayslip({
    expectedGross: 1500,
    expectedTax: 260,
    expectedNet: 1240,
    expectedSuper: 180,
    actualGross: 1450,
    actualTax: 250,
    actualNet: 1200,
    actualSuper: 174,
  });

  nearlyEqual(result.gross.difference, -50);
  nearlyEqual(result.tax.difference, -10);
  nearlyEqual(result.net.difference, -40);
  nearlyEqual(result.super.difference, -6);
  assert.strictEqual(result.overallStatus, 'under_expected');
}

function testComparePayslipTreatsSmallRoundingDifferencesAsMatching() {
  const result = comparePayslip({
    expectedGross: 1000,
    expectedTax: 120,
    expectedNet: 880,
    expectedSuper: 120,
    actualGross: 999.99,
    actualTax: 120.01,
    actualNet: 879.99,
    actualSuper: 120,
    tolerance: 0.05,
  });

  assert.strictEqual(result.gross.status, 'match');
  assert.strictEqual(result.tax.status, 'match');
  assert.strictEqual(result.net.status, 'match');
  assert.strictEqual(result.super.status, 'match');
  assert.strictEqual(result.overallStatus, 'match');
}

const tests = [
  testEstimateSuperDefaultsToTwelvePercent,
  testComparePayslipShowsActualMinusExpectedDifferences,
  testComparePayslipTreatsSmallRoundingDifferencesAsMatching,
];

for (const test of tests) {
  test();
  console.log(`PASS ${test.name}`);
}
