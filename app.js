const STORAGE_KEY = 'driver-hours-pay-entries-v1';
const SETTINGS_KEY = 'driver-hours-pay-settings-v1';

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
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch (_) { return []; }
}

function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function loadSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch (_) { return {}; }
}

function saveSettings() {
  const settings = {
    hourlyRate: document.querySelector('#hourlyRate').value,
    periodType: document.querySelector('#periodType').value,
    anchorDate: document.querySelector('#anchorDate').value,
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

let entries = loadEntries();

function applyDefaults() {
  const settings = loadSettings();
  document.querySelector('#date').value = todayISO();
  document.querySelector('#anchorDate').value = settings.anchorDate || todayISO();
  document.querySelector('#hourlyRate').value = settings.hourlyRate || '35.00';
  document.querySelector('#periodType').value = settings.periodType || 'weekly';
}

function getFormShift() {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    date: document.querySelector('#date').value,
    startTime: document.querySelector('#startTime').value,
    finishTime: document.querySelector('#finishTime').value,
    breakMinutes: document.querySelector('#breakMinutes').value,
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
  entries.sort((a, b) => `${b.date} ${b.startTime}`.localeCompare(`${a.date} ${a.startTime}`));
  saveEntries(entries);
  saveSettings();
  document.querySelector('#note').value = '';
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
  document.querySelector('#rangeLabel').textContent = `${range.start} to ${range.end}`;
  document.querySelector('#daysWorked').textContent = totals.daysWorked;
  document.querySelector('#paidHours').textContent = hours(totals.paidHours);
  document.querySelector('#grossPay').textContent = money(totals.grossPay);
  document.querySelector('#totalBreaks').textContent = minutesLabel(totals.shifts.reduce((sum, shift) => sum + shift.breakMinutes, 0));
}

function renderEntries() {
  const { selected } = selectedEntries();
  const list = document.querySelector('#entryList');
  if (!selected.length) {
    list.innerHTML = '<div class="empty">No shifts saved for this pay period yet.</div>';
    return;
  }

  list.innerHTML = selected.map((entry) => {
    const shift = calculateShift(entry);
    return `
      <article class="entry">
        <div>
          <strong>${shift.date}</strong>
          <div class="muted">${shift.startTime} → ${shift.finishTime} · break ${shift.breakMinutes}m</div>
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

applyDefaults();
document.querySelector('#shiftForm').addEventListener('submit', addShift);
document.querySelector('#duplicateLast').addEventListener('click', duplicateLast);
document.querySelector('#clearAll').addEventListener('click', clearAll);
document.querySelectorAll('input, select').forEach((el) => el.addEventListener('input', render));
document.querySelectorAll('input, select').forEach((el) => el.addEventListener('change', render));
installAppPrompt();
registerServiceWorker();
render();
