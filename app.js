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
      <div><label for="break${number}Start">Break ${number} start</label><input id="break${number}Start" class="break-start" type="time"></div>
      <div><label for="break${number}Finish">Break ${number} finish</label><input id="break${number}Finish" class="break-finish" type="time"></div>
      <div><label for="break${number}Paid">Break ${number} type</label><select id="break${number}Paid" class="break-paid"><option value="unpaid">Unpaid</option><option value="paid">Paid</option></select></div>
      ${removable ? '<button class="remove-break" type="button" aria-label="Remove break">Remove</button>' : ''}
    </div>`;
}

function renumberBreakRows() {
  document.querySelectorAll('#breakRows .break-row').forEach((row, index) => {
    const number = index + 1;
    const start = row.querySelector('.break-start');
    const finish = row.querySelector('.break-finish');
    const paid = row.querySelector('.break-paid');
    const labels = row.querySelectorAll('label');
    start.id = `break${number}Start`;
    finish.id = `break${number}Finish`;
    paid.id = `break${number}Paid`;
    labels[0].setAttribute('for', start.id);
    labels[0].textContent = `Break ${number} start`;
    labels[1].setAttribute('for', finish.id);
    labels[1].textContent = `Break ${number} finish`;
    labels[2].setAttribute('for', paid.id);
    labels[2].textContent = `Break ${number} type`;
    const removeButton = row.querySelector('.remove-break');
    if (removeButton) removeButton.hidden = index === 0;
  });
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
    paid: row.querySelector('.break-paid').value === 'paid',
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
}

function getFormShift() {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    date: document.querySelector('#date').value,
    startTime: document.querySelector('#startTime').value,
    finishTime: document.querySelector('#finishTime').value,
    breakMinutes: document.querySelector('#breakMinutes').value,
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
  entries.push(shift);
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
  const totals = calculateTotals(selected);
  const periodType = document.querySelector('#periodType').value === 'weekly' ? 'weekly' : 'fortnightly';
  const taxFreeThreshold = document.querySelector('#taxFreeThreshold').checked;
  const paygEstimate = paygTables[periodType]
    ? calculateNetPayEstimate(paygTables[periodType], totals.grossPay, taxFreeThreshold)
    : { withholding: 0, netPay: totals.grossPay };

  document.querySelector('#rangeLabel').textContent = `${range.start} to ${range.end}`;
  document.querySelector('#daysWorked').textContent = totals.daysWorked;
  document.querySelector('#paidHours').textContent = hours(totals.paidHours);
  document.querySelector('#grossPay').textContent = money(totals.grossPay);
  document.querySelector('#paygWithholding').textContent = money(paygEstimate.withholding);
  document.querySelector('#netPay').textContent = money(paygEstimate.netPay);
  document.querySelector('#totalBreaks').textContent = minutesLabel(totals.shifts.reduce((sum, shift) => sum + shift.breakMinutes, 0));
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

function render() {
  saveSettings();
  renderSummary();
  renderEntries();
  updatePreview();
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
document.querySelector('#addBreakRow').addEventListener('click', () => {
  addBreakRow();
  render();
});
document.querySelector('#breakRows').addEventListener('click', (event) => {
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
