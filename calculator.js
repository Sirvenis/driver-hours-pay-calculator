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
  if (!breakRow) return 0;
  if (!breakRow.startTime || !breakRow.finishTime) return Math.max(0, cleanNumber(breakRow.durationMinutes));
  const startMinutes = parseTimeToMinutes(breakRow.startTime);
  let finishMinutes = parseTimeToMinutes(breakRow.finishTime);
  if (finishMinutes < startMinutes) {
    finishMinutes += 24 * 60;
  }
  return Math.max(0, finishMinutes - startMinutes);
}

function validTimedBreaks(breaks) {
  return (breaks || []).filter((breakRow) => breakRow && ((breakRow.startTime && breakRow.finishTime) || cleanNumber(breakRow.durationMinutes) > 0));
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

function repeatShift(shift, count, idFactory = (index) => `${Date.now()}-${index}`) {
  const repeatCount = Math.max(1, Math.floor(cleanNumber(count, 1)));
  const start = parseISODate(shift.date);
  return Array.from({ length: repeatCount }, (_, index) => ({
    ...shift,
    id: idFactory(index),
    date: toISODate(addDays(start, index)),
    breaks: (shift.breaks || []).map((breakRow) => ({ ...breakRow })),
  }));
}

function duplicateShiftNextDay(shift, idFactory = () => `${Date.now()}`) {
  const nextDate = toISODate(addDays(parseISODate(shift.date), 1));
  return {
    ...shift,
    id: idFactory(),
    date: nextDate,
    breaks: (shift.breaks || []).map((breakRow) => ({ ...breakRow })),
  };
}

function updateEntryById(entries, id, updatedEntry) {
  return (entries || []).map((entry) => (entry.id === id ? { ...updatedEntry, id } : entry));
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

function pruneEntriesForStorage(entries, anchorDate, days = 14) {
  const range = historyRange(anchorDate, days);
  return (entries || []).filter((entry) => entry.date >= range.start);
}

function toLocalDateTimeParts(now = new Date()) {
  const date = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(date.getTime())) return { date: toISODate(new Date()), time: '00:00' };
  return {
    date: toISODate(date),
    time: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
  };
}

function startTimerShift({ now = new Date(), hourlyRate = '', note = '', location = null } = {}) {
  const parts = toLocalDateTimeParts(now);
  const shift = {
    status: 'running',
    date: parts.date,
    startTime: parts.time,
    finishTime: '',
    breaks: [],
    hourlyRate,
    note,
    source: 'timer',
  };
  return appendTimerLocation(shift, 'start', location, now);
}

function startTimerBreak(timerShift, { now = new Date(), paid = false, location = null } = {}) {
  const parts = toLocalDateTimeParts(now);
  const breaks = (timerShift.breaks || []).map((breakRow) => ({ ...breakRow }));
  return appendTimerLocation({
    ...timerShift,
    status: 'on_break',
    breaks: [...breaks, { startTime: parts.time, finishTime: '', durationMinutes: 0, paid: paid === true }],
  }, 'break_start', location, now);
}

function resumeTimerShift(timerShift, { now = new Date(), location = null } = {}) {
  const parts = toLocalDateTimeParts(now);
  const breaks = (timerShift.breaks || []).map((breakRow) => ({ ...breakRow }));
  const activeIndex = breaks.findLastIndex ? breaks.findLastIndex((breakRow) => breakRow.startTime && !breakRow.finishTime) : (() => {
    for (let index = breaks.length - 1; index >= 0; index -= 1) if (breaks[index].startTime && !breaks[index].finishTime) return index;
    return -1;
  })();
  if (activeIndex >= 0) {
    breaks[activeIndex].finishTime = parts.time;
    breaks[activeIndex].durationMinutes = calculateTimedBreakMinutes(breaks[activeIndex]);
  }
  return appendTimerLocation({ ...timerShift, status: 'running', breaks }, 'break_finish', location, now);
}

function finishTimerShift(timerShift, { now = new Date(), location = null } = {}) {
  const parts = toLocalDateTimeParts(now);
  const resumed = timerShift.status === 'on_break' ? resumeTimerShift(timerShift, { now, location }) : timerShift;
  return appendTimerLocation({ ...resumed, status: 'finished', finishTime: parts.time }, 'finish', location, now);
}

function normalizePosition(position, now = new Date()) {
  if (!position || !position.coords) return null;
  const latitude = Number(position.coords.latitude);
  const longitude = Number(position.coords.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return {
    latitude,
    longitude,
    accuracyMeters: Math.round(Number(position.coords.accuracy) || 0),
    timestamp: new Date(position.timestamp || now).toISOString(),
  };
}

function locationMapUrl(location) {
  if (!location || !Number.isFinite(Number(location.latitude)) || !Number.isFinite(Number(location.longitude))) return '';
  return `https://maps.google.com/?q=${location.latitude},${location.longitude}`;
}

function createLocationEvent(type, position, now = new Date()) {
  const normalized = normalizePosition(position, now);
  if (!normalized) return null;
  return {
    type,
    ...normalized,
    mapUrl: locationMapUrl(normalized),
  };
}

function appendTimerLocation(timerShift, type, position, now = new Date()) {
  const event = createLocationEvent(type, position, now);
  if (!event) return timerShift;
  return {
    ...timerShift,
    locations: [...(timerShift.locations || []), event],
  };
}

function timerShiftToEntry(timerShift, idFactory = () => `${Date.now()}`) {
  const entry = {
    id: timerShift.id || idFactory(),
    date: timerShift.date,
    startTime: timerShift.startTime,
    finishTime: timerShift.finishTime,
    breaks: (timerShift.breaks || []).map((breakRow) => ({ ...breakRow })),
    breakMinutes: 0,
    hourlyRate: timerShift.hourlyRate,
    note: timerShift.note || '',
    source: 'timer',
  };
  if ((timerShift.locations || []).length) entry.locations = timerShift.locations.map((location) => ({ ...location }));
  return entry;
}

function shiftDateTime(entry, timeField) {
  const time = entry[timeField] || '00:00';
  const date = parseISODate(entry.date || toISODate(new Date()));
  const [hours, minutes] = time.split(':').map(Number);
  date.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  if (timeField === 'finishTime' && parseTimeToMinutes(entry.finishTime) < parseTimeToMinutes(entry.startTime)) date.setDate(date.getDate() + 1);
  return date;
}

function buildFatigueWarnings({ enabled = false, entries = [], settings = {} } = {}) {
  if (!enabled) return [];
  const disclaimer = 'Fatigue Assistant: simple warning only, not legal/compliance advice or an authorized fatigue-management system.';
  const longShiftHours = cleanNumber(settings.longShiftHours, 10);
  const noBreakAfterHours = cleanNumber(settings.noBreakAfterHours, 5);
  const minimumRestHours = cleanNumber(settings.minimumRestHours, 10);
  const weeklyHours = cleanNumber(settings.weeklyHours, 60);
  const sorted = (entries || []).slice().sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));
  const warnings = [];

  sorted.forEach((entry, index) => {
    const shift = calculateShift(entry);
    if (shift.paidHours >= longShiftHours) warnings.push({ code: 'long_shift', date: shift.date, message: `Long shift warning: ${shift.paidHours.toFixed(2)} paid hours recorded.`, disclaimer });
    if (shift.totalMinutes >= noBreakAfterHours * 60 && shift.totalBreakMinutes === 0) warnings.push({ code: 'no_break', date: shift.date, message: `No break warning: ${minutesToHours(shift.totalMinutes).toFixed(2)} hours recorded with no break.`, disclaimer });
    if (index > 0) {
      const prev = sorted[index - 1];
      const restHours = (shiftDateTime(entry, 'startTime') - shiftDateTime(prev, 'finishTime')) / (60 * 60 * 1000);
      if (restHours >= 0 && restHours < minimumRestHours) warnings.push({ code: 'short_rest', date: shift.date, message: `Short rest warning: ${restHours.toFixed(1)} hours between shifts.`, disclaimer });
    }
  });

  const totalHours = calculateTotals(sorted).paidHours;
  if (totalHours >= weeklyHours) warnings.push({ code: 'weekly_hours', date: sorted[sorted.length - 1]?.date || '', message: `Recent hours warning: ${totalHours.toFixed(2)} paid hours recorded in the selected history.`, disclaimer });
  return warnings;
}

function buildEmergencyLocationMessage(location, { workerName = '', note = '', eventLabel = 'Emergency / breakdown check-in' } = {}) {
  const map = locationMapUrl(location);
  return [
    eventLabel,
    workerName ? `Worker: ${workerName}` : '',
    note ? `Note: ${note}` : '',
    location?.timestamp ? `Time: ${location.timestamp}` : '',
    location?.accuracyMeters ? `GPS accuracy: approx ${location.accuracyMeters}m` : '',
    map ? `Location: ${map}` : '',
  ].filter(Boolean).join('\n');
}

function buildEmergencySmsHref(location, options = {}) {
  const phone = options.phone || '';
  return `sms:${encodeURIComponent(phone)}?body=${encodeURIComponent(buildEmergencyLocationMessage(location, options))}`;
}

function buildEmergencyMailtoHref(location, options = {}) {
  const email = options.email || '';
  const subject = options.subject || 'Emergency location check-in';
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(buildEmergencyLocationMessage(location, options))}`;
}

if (typeof module !== 'undefined') {
  module.exports = {
    calculateShift,
    calculateTotals,
    calculateBreakMinutes,
    minutesToHours,
    periodRange,
    repeatShift,
    duplicateShiftNextDay,
    updateEntryById,
    filterEntriesByRange,
    historyRange,
    filterEntriesByHistoryRange,
    pruneEntriesToHistoryLimit,
    pruneEntriesForStorage,
    startTimerShift,
    startTimerBreak,
    resumeTimerShift,
    finishTimerShift,
    timerShiftToEntry,
    buildFatigueWarnings,
    createLocationEvent,
    locationMapUrl,
    buildEmergencyLocationMessage,
    buildEmergencySmsHref,
    buildEmergencyMailtoHref,
  };
}
