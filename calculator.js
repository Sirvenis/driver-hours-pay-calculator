function cleanNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function minutesToHours(minutes) {
  return cleanNumber(minutes) / 60;
}

function parseTimeToMinutes(time) {
  if (!time || typeof time !== 'string' || !time.includes(':')) return 0;
  const [hours, minutes] = time.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return hours * 60 + minutes;
}

function calculateTimedBreakMinutes(breakRow) {
  if (!breakRow || !breakRow.startTime || !breakRow.finishTime) return 0;
  const startMinutes = parseTimeToMinutes(breakRow.startTime);
  let finishMinutes = parseTimeToMinutes(breakRow.finishTime);
  if (finishMinutes < startMinutes) {
    finishMinutes += 24 * 60;
  }
  return Math.max(0, finishMinutes - startMinutes);
}

function validTimedBreaks(breaks) {
  return (breaks || []).filter((breakRow) => breakRow && breakRow.startTime && breakRow.finishTime);
}

function calculateBreakMinutes(breaks, fallbackBreakMinutes = 0) {
  const validBreaks = validTimedBreaks(breaks);
  if (!validBreaks.length) return Math.max(0, cleanNumber(fallbackBreakMinutes));
  return validBreaks
    .filter((breakRow) => breakRow.paid !== true)
    .reduce((sum, breakRow) => sum + calculateTimedBreakMinutes(breakRow), 0);
}

function calculatePaidBreakMinutes(breaks) {
  return validTimedBreaks(breaks)
    .filter((breakRow) => breakRow.paid === true)
    .reduce((sum, breakRow) => sum + calculateTimedBreakMinutes(breakRow), 0);
}

function calculateTotalBreakMinutes(breaks, fallbackBreakMinutes = 0) {
  const validBreaks = validTimedBreaks(breaks);
  if (!validBreaks.length) return Math.max(0, cleanNumber(fallbackBreakMinutes));
  return validBreaks.reduce((sum, breakRow) => sum + calculateTimedBreakMinutes(breakRow), 0);
}

function calculateShift(input) {
  const date = input.date || '';
  const startTime = input.startTime || '00:00';
  const finishTime = input.finishTime || '00:00';
  const breakMinutes = calculateBreakMinutes(input.breaks, input.breakMinutes);
  const paidBreakMinutes = calculatePaidBreakMinutes(input.breaks);
  const totalBreakMinutes = calculateTotalBreakMinutes(input.breaks, input.breakMinutes);
  const hourlyRate = Math.max(0, cleanNumber(input.hourlyRate));

  const startMinutes = parseTimeToMinutes(startTime);
  let finishMinutes = parseTimeToMinutes(finishTime);

  if (finishMinutes < startMinutes) {
    finishMinutes += 24 * 60;
  }

  const totalMinutes = Math.max(0, finishMinutes - startMinutes);
  const paidMinutes = Math.max(0, totalMinutes - breakMinutes);
  const paidHours = minutesToHours(paidMinutes);
  const grossPay = paidHours * hourlyRate;

  return {
    id: input.id || '',
    date,
    startTime,
    finishTime,
    breakMinutes,
    paidBreakMinutes,
    totalBreakMinutes,
    hourlyRate,
    totalMinutes,
    paidMinutes,
    paidHours,
    grossPay,
  };
}

function calculateTotals(entries) {
  const shifts = (entries || []).map(calculateShift);
  const totalMinutes = shifts.reduce((sum, shift) => sum + shift.totalMinutes, 0);
  const paidMinutes = shifts.reduce((sum, shift) => sum + shift.paidMinutes, 0);
  const grossPay = shifts.reduce((sum, shift) => sum + shift.grossPay, 0);

  return {
    daysWorked: shifts.length,
    totalMinutes,
    paidMinutes,
    paidHours: minutesToHours(paidMinutes),
    grossPay,
    shifts,
  };
}

function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseISODate(value) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(date, days) {
  const copy = new Date(date.getTime());
  copy.setDate(copy.getDate() + days);
  return copy;
}

function periodRange(anchorDate, periodType) {
  const start = parseISODate(anchorDate);
  const days = periodType === 'weekly' ? 7 : 14;
  return { start: toISODate(start), end: toISODate(addDays(start, days - 1)) };
}

function filterEntriesByRange(entries, start, end) {
  return (entries || []).filter((entry) => entry.date >= start && entry.date <= end);
}

function historyRange(anchorDate, days = 14) {
  const date = parseISODate(anchorDate);
  const start = addDays(date, -(Math.max(1, cleanNumber(days, 14)) - 1));
  return { start: toISODate(start), end: toISODate(date) };
}

function filterEntriesByHistoryRange(entries, anchorDate, days = 14) {
  const range = historyRange(anchorDate, days);
  return filterEntriesByRange(entries, range.start, range.end);
}

function pruneEntriesToHistoryLimit(entries, anchorDate, days = 14) {
  const range = historyRange(anchorDate, days);
  return (entries || []).filter((entry) => entry.date >= range.start && entry.date <= range.end);
}

if (typeof module !== 'undefined') {
  module.exports = {
    calculateShift,
    calculateTotals,
    calculateBreakMinutes,
    minutesToHours,
    periodRange,
    filterEntriesByRange,
    historyRange,
    filterEntriesByHistoryRange,
    pruneEntriesToHistoryLimit,
  };
}
