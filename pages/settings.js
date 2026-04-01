// Settings.js - Settings page logic

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  setupEventListeners();
});

// ── Event listeners ────────────────────────────────────────────
function setupEventListeners() {
  document.getElementById('backBtn').addEventListener('click', () => {
    window.history.length > 1 ? window.history.back() : window.close();
  });

  document.getElementById('addR365MappingBtn').addEventListener('click',   () => addMapping('r365'));
  document.getElementById('addToastMappingBtn').addEventListener('click',  () => addMapping('toast'));
  document.getElementById('saveSettingsBtn').addEventListener('click',     saveSettings);
  document.getElementById('resetSettingsBtn').addEventListener('click',    resetSettings);

  document.getElementById('exportDataBtn').addEventListener('click', exportData);
  document.getElementById('importDataBtn').addEventListener('click',  () => document.getElementById('importFileInput').click());
  document.getElementById('importFileInput').addEventListener('change', importData);

  document.getElementById('clearR365Btn').addEventListener('click',  clearR365Data);
  document.getElementById('clearToastBtn').addEventListener('click', clearToastData);
  document.getElementById('clearAllBtn').addEventListener('click',   clearAllData);

  // Real-time validation on minDifference input
  document.getElementById('minDifference').addEventListener('input', validateMinDifference);
}

// ── Load settings ──────────────────────────────────────────────
async function loadSettings() {
  try {
    const [mappings, settings, messages] = await Promise.all([
      StorageManager.getAccountMappings(),
      StorageManager.getSettings(),
      StorageManager.getCustomMessages(),
    ]);

    renderMappings('r365',   mappings.r365  || {});
    renderMappings('toast',  mappings.toast || {});

    document.getElementById('minDifference').value           = settings.minDifferenceAmount ?? 0.01;
    document.getElementById('autoExtract').checked           = settings.autoExtract ?? false;
    document.getElementById('showNotifications').checked     = settings.showNotifications !== false;

    document.getElementById('r365OnlyMsg').value    = messages.r365Only   || '';
    document.getElementById('toastOnlyMsg').value   = messages.toastOnly  || '';
    document.getElementById('amountDiffMsg').value  = messages.amountDiff || '';

  } catch (error) {
    console.error('[Settings] Failed to load:', error);
    showMessage('Failed to load settings', 'error');
  }
}

// ── Render account mappings list ───────────────────────────────
function renderMappings(system, mappings) {
  const container = document.getElementById(`${system}Mappings`);
  container.innerHTML = '';
  Object.entries(mappings).forEach(([from, to]) => {
    container.appendChild(createMappingElement(system, from, to));
  });
}

function createMappingElement(system, from, to) {
  const div = document.createElement('div');
  div.className = 'mapping-item';
  // Sanitize values before placing into attributes
  const safeFrom = String(from).replace(/"/g, '&quot;');
  const safeTo   = String(to).replace(/"/g, '&quot;');
  div.innerHTML = `
    <input type="text" class="from-account" value="${safeFrom}" placeholder="Original account">
    <span>→</span>
    <input type="text" class="to-account" value="${safeTo}" placeholder="Mapped account">
    <button class="btn-delete" data-system="${system}" data-from="${safeFrom}" title="Delete mapping">×</button>
  `;
  div.querySelector('.btn-delete').addEventListener('click', e => {
    deleteMapping(e.target.dataset.system, e.target.dataset.from);
  });
  return div;
}

function addMapping(system) {
  const container = document.getElementById(`${system}Mappings`);
  container.appendChild(createMappingElement(system, '', ''));
}

async function deleteMapping(system, from) {
  if (!confirm('Delete this mapping?')) return;
  try {
    const mappings = await StorageManager.getAccountMappings();
    delete mappings[system][from];
    await StorageManager.saveAccountMappings(mappings);
    renderMappings(system, mappings[system]);
    showMessage('Mapping deleted', 'success');
  } catch (error) {
    showMessage('Failed to delete mapping', 'error');
  }
}

// ── Validation ─────────────────────────────────────────────────
function validateMinDifference() {
  const input = document.getElementById('minDifference');
  const errEl = document.getElementById('minDifferenceError');
  const val   = parseFloat(input.value);

  if (isNaN(val) || val < 0) {
    input.classList.add('input-error');
    if (errEl) errEl.style.display = 'block';
    return false;
  }

  input.classList.remove('input-error');
  if (errEl) errEl.style.display = 'none';
  return true;
}

// ── Save settings ──────────────────────────────────────────────
async function saveSettings() {
  // Validate before saving
  if (!validateMinDifference()) {
    showMessage('Please fix validation errors before saving', 'error');
    return;
  }

  try {
    // Collect R365 mappings
    const r365Mappings = {};
    document.querySelectorAll('#r365Mappings .mapping-item').forEach(item => {
      const from = item.querySelector('.from-account').value.trim();
      const to   = item.querySelector('.to-account').value.trim();
      if (from && to) r365Mappings[from] = to;
    });

    // Collect Toast mappings
    const toastMappings = {};
    document.querySelectorAll('#toastMappings .mapping-item').forEach(item => {
      const from = item.querySelector('.from-account').value.trim();
      const to   = item.querySelector('.to-account').value.trim();
      if (from && to) toastMappings[from] = to;
    });

    await StorageManager.saveAccountMappings({ r365: r365Mappings, toast: toastMappings });

    await StorageManager.saveSettings({
      minDifferenceAmount: parseFloat(document.getElementById('minDifference').value),
      autoExtract:         document.getElementById('autoExtract').checked,
      showNotifications:   document.getElementById('showNotifications').checked,
    });

    await StorageManager.saveCustomMessages({
      r365Only:   document.getElementById('r365OnlyMsg').value,
      toastOnly:  document.getElementById('toastOnlyMsg').value,
      amountDiff: document.getElementById('amountDiffMsg').value,
    });

    showMessage('✔ Settings saved successfully!', 'success');

  } catch (error) {
    console.error('[Settings] Failed to save:', error);
    showMessage('Failed to save settings', 'error');
  }
}

// ── Reset settings ─────────────────────────────────────────────
async function resetSettings() {
  if (!confirm('Reset all settings to defaults?')) return;
  try {
    await StorageManager.saveAccountMappings({ r365: {}, toast: {} });
    await StorageManager.saveSettings({ minDifferenceAmount: 0.01, autoExtract: false, showNotifications: true });
    await StorageManager.saveCustomMessages({});
    await loadSettings();
    showMessage('Settings reset to defaults', 'success');
  } catch (error) {
    showMessage('Failed to reset settings', 'error');
  }
}

// ── Export ─────────────────────────────────────────────────────
async function exportData() {
  try {
    const data = await StorageManager.exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `r365-toast-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showMessage('✔ Data exported successfully', 'success');
  } catch (error) {
    showMessage('Failed to export data', 'error');
  }
}

// ── Import ─────────────────────────────────────────────────────
async function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    await StorageManager.importData(text);
    await loadSettings();
    showMessage('✔ Data imported successfully', 'success');
  } catch (error) {
    showMessage('Failed to import data – make sure the file is valid JSON', 'error');
  }
  // Reset file input so same file can be re-imported if needed
  event.target.value = '';
}

// ── Clear data ─────────────────────────────────────────────────
async function clearR365Data() {
  if (!confirm('Clear all R365 data?')) return;
  try { await StorageManager.clearR365Data(); showMessage('R365 data cleared', 'success'); }
  catch { showMessage('Failed to clear R365 data', 'error'); }
}

async function clearToastData() {
  if (!confirm('Clear all Toast data?')) return;
  try { await StorageManager.clearToastData(); showMessage('Toast data cleared', 'success'); }
  catch { showMessage('Failed to clear Toast data', 'error'); }
}

async function clearAllData() {
  if (!confirm('Clear ALL data? This cannot be undone!')) return;
  try {
    await StorageManager.clearAllData();
    await loadSettings();
    showMessage('All data cleared', 'success');
  } catch { showMessage('Failed to clear all data', 'error'); }
}

// ── Status message ─────────────────────────────────────────────
function showMessage(message, type) {
  const el = document.getElementById('statusMessage');
  el.textContent = message;
  el.className   = `status-message ${type}`;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 5000);
}