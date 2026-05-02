const STORAGE_KEY = 'wagecheck-au-entries-v1';
const SETTINGS_KEY = 'wagecheck-au-settings-v1';
const LEGACY_STORAGE_KEY = 'driver-hours-pay-entries-v1';
const LEGACY_SETTINGS_KEY = 'driver-hours-pay-settings-v1';
const FREE_HISTORY_DAYS = 14;
const PAYG_TABLE_URLS = {
  weekly: './data/payg-weekly-2024.json',
  fortnightly: './data/payg-fortnightly-2024.json',
};
const paygTables = {};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function money(value) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value || 0);
}

function hours(value) {
  return `${(value || 0).toFixed(2)}h`;
}

function minutesLabel(minutes) {
  const h = Math.floor((minutes || 0) / 60);
  const m = Math.round((minutes || 0) % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function loadEntries() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY) || '[]';
    return pruneEntriesToHistoryLimit(JSON.parse(saved), todayISO(), FREE_HISTORY_DAYS);
  } catch (_) { return []; }
}

function saveEntries(entriesToSave) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pruneEntriesToHistoryLimit(entriesToSave, todayISO(), FREE_HISTORY_DAYS)));
}

function loadSettings() {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY) || localStorage.getItem(LEGACY_SETTINGS_KEY) || '{}';
    return JSON.parse(saved);
  } catch (_) { return {}; }
}

function breakRowTemplate(number, removable = true) {
  return `
    <div class="break-row">
      <div class="break-number">B${number}</div>
      <input id="break${number}Start" class="break-start" type="time" aria-label="Break ${number} start">
      <input id="break${number}Finish" class="break-finish" type="time" aria-label="Break ${number} finish">
      <button class="break-duration unpaid" type="button" data-paid="false" aria-label="Break ${number} unpaid duration">0m</button>
      ${removable ? '<button class="remove-break" type="button" aria-label="Remove break">×</button>' : ''}
    </div>`;
}

function breakDurationMinutes(startTime, finishTime) {
  if (!startTime || !finishTime) return 0;
  const [startHours, startMinutes] = startTime.split(':').map(Number);
  const [finishHours, finishMinutes] = finishTime.split(':').map(Number);
  if (![startHours, startMinutes, finishHours, finishMinutes].every(Number.isFinite)) return 0;
  const start = startHours * 60 + startMinutes;
  let finish = finishHours * 60 + finishMinutes;
  if (finish < start) finish += 24 * 60;
  return Math.max(0, finish - start);
}

function updateBreakDurations() {
  document.querySelectorAll('#breakRows .break-row').forEach((row, index) => {
    const number = index + 1;
    const start = row.querySelector('.break-start');
    const finish = row.querySelector('.break-finish');
    const duration = row.querySelector('.break-duration');
    const minutes = breakDurationMinutes(start.value, finish.value);
    const paid = duration.dataset.paid === 'true';
    duration.textContent = minutesLabel(minutes);
    duration.classList.toggle('paid', paid);
    duration.classList.toggle('unpaid', !paid);
    duration.setAttribute('aria-label', `Break ${number} ${paid ? 'paid' : 'unpaid'} duration ${minutesLabel(minutes)}`);
  });
}

function renumberBreakRows() {
  document.querySelectorAll('#breakRows .break-row').forEach((row, index) => {
    const number = index + 1;
    const start = row.querySelector('.break-start');
    const finish = row.querySelector('.break-finish');
    const duration = row.querySelector('.break-duration');
    const breakNumber = row.querySelector('.break-number');
    start.id = `break${number}Start`;
    finish.id = `break${number}Finish`;
    start.setAttribute('aria-label', `Break ${number} start`);
    finish.setAttribute('aria-label', `Break ${number} finish`);
    breakNumber.textContent = `B${number}`;
    duration.setAttribute('aria-label', `Break ${number} ${duration.dataset.paid === 'true' ? 'paid' : 'unpaid'} duration`);
    const removeButton = row.querySelector('.remove-break');
    if (removeButton) removeButton.hidden = index === 0;
  });
  updateBreakDurations();
}

function addBreakRow() {
  const breakRows = document.querySelector('#breakRows');
  const number = breakRows.querySelectorAll('.break-row').length + 1;
  breakRows.insertAdjacentHTML('beforeend', breakRowTemplate(number, true));
  renumberBreakRows();
}

function getBreakRows() {
  return Array.from(document.querySelectorAll('#breakRows .break-row')).map((row) => ({
    startTime: row.querySelector('.break-start').value,
    finishTime: row.querySelector('.break-finish').value,
    paid: row.querySelector('.break-duration').dataset.paid === 'true',
  })).filter((breakRow) => breakRow.startTime || breakRow.finishTime);
}

function clearBreakRows() {
  const breakRows = document.querySelector('#breakRows');
  breakRows.innerHTML = breakRowTemplate(1, false);
}

function formatBreakRows(breaks) {
  const validBreaks = (breaks || []).filter((breakRow) => breakRow.startTime && breakRow.finishTime);
  return validBreaks.map((breakRow) => {
    const status = breakRow.paid === true ? 'paid' : 'unpaid';
    return `${breakRow.startTime}-${breakRow.finishTime} (${status})`;
  }).join(', ');
}

function saveSettings() {
  const settings = {
    hourlyRate: document.querySelector('#hourlyRate').value,
    periodType: document.querySelector('#periodType').value,
    anchorDate: document.querySelector('#anchorDate').value,
    taxFreeThreshold: document.querySelector('#taxFreeThreshold').checked,
    workerName: document.querySelector('#workerName').value.trim(),
    payOfficeEmail: document.querySelector('#payOfficeEmail').value.trim(),
    employerName: document.querySelector('#employerName').value.trim(),
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

let entries = loadEntries();

function applyDefaults() {
  const settings = loadSettings();
  document.querySelector('#date').value = todayISO();
  document.querySelector('#anchorDate').value = settings.anchorDate || todayISO();
  document.querySelector('#hourlyRate').value = settings.hourlyRate || '35.00';
  document.querySelector('#periodType').value = settings.periodType || 'fortnightly';
  document.querySelector('#taxFreeThreshold').checked = settings.taxFreeThreshold !== false;
  document.querySelector('#workerName').value = settings.workerName || '';
  document.querySelector('#payOfficeEmail').value = settings.payOfficeEmail || '';
  document.querySelector('#employerName').value = settings.employerName || '';
}

function getFormShift() {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    date: document.querySelector('#date').value,
    startTime: document.querySelector('#startTime').value,
    finishTime: document.querySelector('#finishTime').value,
    breakMinutes: 0,
    breaks: getBreakRows(),
    hourlyRate: document.querySelector('#hourlyRate').value,
    note: document.querySelector('#note').value.trim(),
  };
}

function addShift(event) {
  event.preventDefault();
  const shift = getFormShift();
  if (!shift.date || !shift.startTime || !shift.finishTime) {
    alert('Please enter a date, start time, and finish time.');
    return;
  }
  entries.push(...repeatShift(shift, document.querySelector('#repeatCount').value, (index) => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${index}`)));
  entries = pruneEntriesToHistoryLimit(entries, todayISO(), FREE_HISTORY_DAYS);
  entries.sort((a, b) => `${b.date} ${b.startTime}`.localeCompare(`${a.date} ${a.startTime}`));
  saveEntries(entries);
  saveSettings();
  document.querySelector('#note').value = '';
  clearBreakRows();
  render();
}

function deleteShift(id) {
  entries = entries.filter((entry) => entry.id !== id);
  saveEntries(entries);
  render();
}

function duplicateLast() {
  if (!entries.length) return;
  const last = entries[0];
  const copy = { ...last, id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), date: document.querySelector('#date').value || todayISO() };
  entries.unshift(copy);
  saveEntries(entries);
  render();
}

function clearAll() {
  if (!confirm('Delete all saved shifts?')) return;
  entries = [];
  saveEntries(entries);
  render();
}

function selectedEntries() {
  const anchorDate = document.querySelector('#anchorDate').value || todayISO();
  const periodType = document.querySelector('#periodType').value;
  const range = periodRange(anchorDate, periodType);
  return { range, selected: filterEntriesByRange(entries, range.start, range.end) };
}

function renderSummary() {
  const { range, selected } = selectedEntries();
  const { totals, paygEstimate } = currentPayEstimate(selected);

  document.querySelector('#rangeLabel').textContent = `${range.start} to ${range.end}`;
  document.querySelector('#daysWorked').textContent = totals.daysWorked;
  document.querySelector('#paidHours').textContent = hours(totals.paidHours);
  document.querySelector('#grossPay').textContent = money(totals.grossPay);
  document.querySelector('#paygWithholding').textContent = money(paygEstimate.withholding);
  document.querySelector('#netPay').textContent = money(paygEstimate.netPay);
  document.querySelector('#totalBreaks').textContent = minutesLabel(totals.shifts.reduce((sum, shift) => sum + shift.breakMinutes, 0));
}

function currentPayEstimate(selected = selectedEntries().selected) {
  const totals = calculateTotals(selected);
  const periodType = document.querySelector('#periodType').value === 'weekly' ? 'weekly' : 'fortnightly';
  const taxFreeThreshold = document.querySelector('#taxFreeThreshold').checked;
  const paygEstimate = paygTables[periodType]
    ? calculateNetPayEstimate(paygTables[periodType], totals.grossPay, taxFreeThreshold)
    : { withholding: 0, netPay: totals.grossPay };
  return { totals, paygEstimate };
}

function historyEntries() {
  const range = historyRange(todayISO(), FREE_HISTORY_DAYS);
  const selected = filterEntriesByHistoryRange(entries, todayISO(), FREE_HISTORY_DAYS)
    .sort((a, b) => `${b.date} ${b.startTime}`.localeCompare(`${a.date} ${a.startTime}`));
  return { range, selected };
}

function renderEntries() {
  const { range, selected } = historyEntries();
  const list = document.querySelector('#entryList');
  const label = document.querySelector('#historyRangeLabel');
  if (label) label.textContent = `${range.start} to ${range.end}`;
  if (!selected.length) {
    list.innerHTML = '<div class="empty">No shifts saved in your free 14-day history yet.</div>';
    return;
  }

  list.innerHTML = selected.map((entry) => {
    const shift = calculateShift(entry);
    return `
      <article class="entry">
        <div>
          <strong>${shift.date}</strong>
          <div class="muted">${shift.startTime} → ${shift.finishTime} · break ${shift.breakMinutes}m</div>
          ${formatBreakRows(entry.breaks) ? `<div class="muted">Break times: ${escapeHtml(formatBreakRows(entry.breaks))}</div>` : ''}
          ${entry.note ? `<div class="note">${escapeHtml(entry.note)}</div>` : ''}
        </div>
        <div class="entry-right">
          <div class="entry-pay">${money(shift.grossPay)}</div>
          <div class="muted">${hours(shift.paidHours)}</div>
          <button class="delete" onclick="deleteShift('${shift.id}')">Delete</button>
        </div>
      </article>`;
  }).join('');
}

function escapeHtml(text) {
  return text.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char]));
}

function updatePreview() {
  const preview = calculateShift(getFormShift());
  document.querySelector('#previewHours').textContent = hours(preview.paidHours);
  document.querySelector('#previewPay').textContent = money(preview.grossPay);
}

function currentTimesheetPayload() {
  const { range, selected } = selectedEntries();
  return {
    range,
    entries: selected,
    workerName: document.querySelector('#workerName').value.trim(),
    employer: document.querySelector('#employerName').value.trim(),
  };
}

function currentTimesheetText() {
  return buildTimesheetText(currentTimesheetPayload());
}

function currentTimesheetCsv() {
  return buildTimesheetCsv(currentTimesheetPayload());
}

function updateTimesheetStatus(message) {
  const { selected } = selectedEntries();
  document.querySelector('#timesheetStatus').textContent = message || `${selected.length} shift${selected.length === 1 ? '' : 's'} in the selected pay period.`;
}

function emailTimesheet() {
  const { selected, range } = selectedEntries();
  if (!selected.length) {
    updateTimesheetStatus('No shifts in the selected pay period to send.');
    return;
  }
  saveSettings();
  const email = document.querySelector('#payOfficeEmail').value.trim();
  const subject = `Timesheet ${range.start} to ${range.end}`;
  const body = currentTimesheetText();
  window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  updateTimesheetStatus('Opening your email app with the timesheet text.');
}

async function shareTimesheet() {
  const { selected, range } = selectedEntries();
  if (!selected.length) {
    updateTimesheetStatus('No shifts in the selected pay period to share.');
    return;
  }
  const text = currentTimesheetText();
  if (navigator.share) {
    await navigator.share({ title: `Timesheet ${range.start} to ${range.end}`, text });
    updateTimesheetStatus('Timesheet shared.');
    return;
  }
  await navigator.clipboard.writeText(text);
  updateTimesheetStatus('Share sheet is unavailable here, so the timesheet was copied instead.');
}

async function copyTimesheet() {
  const { selected } = selectedEntries();
  if (!selected.length) {
    updateTimesheetStatus('No shifts in the selected pay period to copy.');
    return;
  }
  await navigator.clipboard.writeText(currentTimesheetText());
  updateTimesheetStatus('Timesheet copied. Paste it into email, SMS, WhatsApp, or your work app.');
}

function downloadTimesheetCsv() {
  const { selected, range } = selectedEntries();
  if (!selected.length) {
    updateTimesheetStatus('No shifts in the selected pay period to download.');
    return;
  }
  const blob = new Blob([currentTimesheetCsv()], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `wagecheck-timesheet-${range.start}-to-${range.end}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  updateTimesheetStatus('CSV timesheet downloaded.');
}

function printTimesheet() {
  const { selected } = selectedEntries();
  if (!selected.length) {
    updateTimesheetStatus('No shifts in the selected pay period to print.');
    return;
  }
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    updateTimesheetStatus('Pop-up blocked. Try Copy Text or CSV instead.');
    return;
  }
  printWindow.document.open();
  printWindow.document.write(buildTimesheetPrintHtml(currentTimesheetPayload()));
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  updateTimesheetStatus('Print view opened. Choose Save as PDF from the print dialog.');
}

function renderPayslipComparison() {
  const { selected } = selectedEntries();
  const { totals, paygEstimate } = currentPayEstimate(selected);
  const expectedSuper = estimateSuper(totals.grossPay);
  const actual = {
    actualGross: document.querySelector('#actualGross').value,
    actualTax: document.querySelector('#actualTax').value,
    actualNet: document.querySelector('#actualNet').value,
    actualSuper: document.querySelector('#actualSuper').value,
  };
  const hasActual = Object.values(actual).some((value) => value !== '');
  const comparisonBox = document.querySelector('#payslipComparison');
  const status = document.querySelector('#payslipStatus');
  if (!hasActual) {
    status.textContent = `Expected: gross ${money(totals.grossPay)}, tax ${money(paygEstimate.withholding)}, net ${money(paygEstimate.netPay)}, super ${money(expectedSuper)}.`;
    comparisonBox.innerHTML = '';
    return;
  }
  const comparison = comparePayslip({
    expectedGross: totals.grossPay,
    expectedTax: paygEstimate.withholding,
    expectedNet: paygEstimate.netPay,
    expectedSuper,
    ...actual,
  });
  status.textContent = comparison.overallStatus === 'under_expected'
    ? 'Some payslip amounts are under the app estimate. Check the details before contacting payroll.'
    : comparison.overallStatus === 'over_expected'
      ? 'Some payslip amounts are over the app estimate. Check overtime, allowances, and tax settings.'
      : 'Payslip amounts are within rounding tolerance of the app estimate.';
  comparisonBox.innerHTML = [
    ['Gross', comparison.gross],
    ['Tax', comparison.tax],
    ['Net', comparison.net],
    ['Super', comparison.super],
  ].map(([label, item]) => `<div class="compare-card ${item.status}"><div class="muted">${label}</div><div>Expected ${money(item.expected)}</div><div>Actual ${money(item.actual)}</div><div class="diff">${item.difference >= 0 ? '+' : ''}${money(item.difference)}</div></div>`).join('');
}

function render() {
  updateBreakDurations();
  saveSettings();
  renderSummary();
  renderEntries();
  updatePreview();
  renderPayslipComparison();
  updateTimesheetStatus();
}

function installAppPrompt() {
  let deferredPrompt;
  const installButton = document.querySelector('#installButton');
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    installButton.hidden = false;
  });
  installButton.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installButton.hidden = true;
  });
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}

async function loadPaygTables() {
  await Promise.all(Object.entries(PAYG_TABLE_URLS).map(async ([period, url]) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Unable to load ${period} PAYG table`);
    paygTables[period] = await response.json();
  }));
}

applyDefaults();
renumberBreakRows();
document.querySelector('#shiftForm').addEventListener('submit', addShift);
document.querySelector('#duplicateLast').addEventListener('click', duplicateLast);
document.querySelector('#clearAll').addEventListener('click', clearAll);
document.querySelector('#emailTimesheet').addEventListener('click', emailTimesheet);
document.querySelector('#shareTimesheet').addEventListener('click', () => shareTimesheet().catch(() => updateTimesheetStatus('Unable to share this timesheet. Try Copy Text instead.')));
document.querySelector('#copyTimesheet').addEventListener('click', () => copyTimesheet().catch(() => updateTimesheetStatus('Unable to copy automatically. Try Email Timesheet instead.')));
document.querySelector('#downloadTimesheetCsv').addEventListener('click', downloadTimesheetCsv);
document.querySelector('#printTimesheet').addEventListener('click', printTimesheet);
document.querySelector('#addBreakRow').addEventListener('click', () => {
  addBreakRow();
  render();
});
document.querySelector('#breakRows').addEventListener('click', (event) => {
  if (event.target.classList.contains('break-duration')) {
    event.target.dataset.paid = event.target.dataset.paid === 'true' ? 'false' : 'true';
    render();
    return;
  }
  if (!event.target.classList.contains('remove-break')) return;
  event.target.closest('.break-row').remove();
  renumberBreakRows();
  render();
});
document.addEventListener('input', (event) => {
  if (event.target.matches('input, select')) render();
});
document.addEventListener('change', (event) => {
  if (event.target.matches('input, select')) render();
});
installAppPrompt();
registerServiceWorker();
loadPaygTables().then(render).catch(() => render());
render();
