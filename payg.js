function normaliseEarnings(earnings) {
  const value = Number(earnings);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function findNearestLowerRow(rows, earnings) {
  if (!Array.isArray(rows) || rows.length === 0 || earnings <= 0) {
    return { earnings: 0, withTaxFreeThreshold: 0, noTaxFreeThreshold: 0 };
  }

  let low = 0;
  let high = rows.length - 1;
  let match = null;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const row = rows[mid];
    if (row.earnings <= earnings) {
      match = row;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return match || { earnings: 0, withTaxFreeThreshold: 0, noTaxFreeThreshold: 0 };
}

function lookupPaygWithholding(table, earnings, taxFreeThreshold = true) {
  const normalisedEarnings = normaliseEarnings(earnings);
  const row = findNearestLowerRow(table && table.rows, normalisedEarnings);
  const withholding = taxFreeThreshold ? row.withTaxFreeThreshold : row.noTaxFreeThreshold;

  return {
    period: table && table.period ? table.period : '',
    earnings: normalisedEarnings,
    tableEarnings: row.earnings,
    taxFreeThreshold: Boolean(taxFreeThreshold),
    withholding: withholding || 0,
  };
}

function calculateNetPayEstimate(table, earnings, taxFreeThreshold = true) {
  const result = lookupPaygWithholding(table, earnings, taxFreeThreshold);
  return {
    ...result,
    netPay: Math.max(0, result.earnings - result.withholding),
  };
}

if (typeof module !== 'undefined') {
  module.exports = {
    lookupPaygWithholding,
    calculateNetPayEstimate,
  };
}
