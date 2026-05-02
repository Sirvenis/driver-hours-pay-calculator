function cleanPayslipNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function estimateSuper(grossPay, rate = 0.12) {
  return cleanPayslipNumber(grossPay) * cleanPayslipNumber(rate, 0.12);
}

function compareAmount(expected, actual, tolerance = 0.05) {
  const expectedAmount = cleanPayslipNumber(expected);
  const actualAmount = cleanPayslipNumber(actual);
  const difference = actualAmount - expectedAmount;
  const status = Math.abs(difference) <= tolerance ? 'match' : (difference < 0 ? 'under' : 'over');
  return { expected: expectedAmount, actual: actualAmount, difference, status };
}

function comparePayslip(input) {
  const tolerance = cleanPayslipNumber(input.tolerance, 0.05);
  const result = {
    gross: compareAmount(input.expectedGross, input.actualGross, tolerance),
    tax: compareAmount(input.expectedTax, input.actualTax, tolerance),
    net: compareAmount(input.expectedNet, input.actualNet, tolerance),
    super: compareAmount(input.expectedSuper, input.actualSuper, tolerance),
  };
  const underExpected = result.gross.status === 'under' || result.net.status === 'under' || result.super.status === 'under';
  const overExpected = result.gross.status === 'over' || result.net.status === 'over' || result.super.status === 'over';
  result.overallStatus = underExpected ? 'under_expected' : (overExpected ? 'over_expected' : 'match');
  return result;
}

if (typeof module !== 'undefined') {
  module.exports = { estimateSuper, comparePayslip, compareAmount };
}
