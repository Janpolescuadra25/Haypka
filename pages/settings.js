// Settings.js - Settings page logic

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
  document.getElementById('backBtn').addEventListener('click', () => {
    window.location.href = 'dashboard.html';
  });
  
  document.getElementById('addR365MappingBtn').addEventListener('click', () => addMapping('r365'));
  document.getElementById('addToastMappingBtn').addEventListener('click', () => addMapping('toast'));
  document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
  document.getElementById('resetSettingsBtn').addEventListener('click', resetSettings);
  
  document.getElementById('exportDataBtn').addEventListener('click', exportData);
  document.getElementById('importDataBtn').addEventListener('click', () => {
    document.getElementById('importFileInput').click();
  });
  document.getElementById('importFileInput').addEventListener('change', importData);
  
  document.getElementById('clearR365Btn').addEventListener('click', clearR365Data);
  document.getElementById('clearToastBtn').addEventListener('click', clearToastData);
  document.getElementById('clearAllBtn').addEventListener('click', clearAllData);
}

// Load current settings
async function loadSettings() {
  try {
    const mappings = await StorageManager.getAccountMappings();
    const settings = await StorageManager.getSettings();
    const messages = await StorageManager.getCustomMessages();
    
    // Load account mappings
    renderMappings('r365', mappings.r365 || {});
    renderMappings('toast', mappings.toast || {});
    
    // Load comparison settings
    document.getElementById('minDifference').value = settings.minDifferenceAmount || 0.01;
    document.getElementById('autoExtract').checked = settings.autoExtract || false;
    document.getElementById('showNotifications').checked = settings.showNotifications !== false;
    
    // Load custom messages
    document.getElementById('r365OnlyMsg').value = messages.r365Only || '';
    document.getElementById('toastOnlyMsg').value = messages.toastOnly || '';
    document.getElementById('amountDiffMsg').value = messages.amountDiff || '';
    
  } catch (error) {
    console.error('Failed to load settings:', error);
    showMessage('Failed to load settings', 'error');
  }
}

// Render account mappings
function renderMappings(system, mappings) {
  const container = document.getElementById(`${system}Mappings`);
  container.innerHTML = '';
  
  Object.entries(mappings).forEach(([from, to]) => {
    const mappingEl = createMappingElement(system, from, to);
    container.appendChild(mappingEl);
  });
}

// Create mapping element
function createMappingElement(system, from, to) {
  const div = document.createElement('div');
  div.className = 'mapping-item';
  div.innerHTML = `
    <input type="text" class="from-account" value="${from}" placeholder="Original account">
    <span>→</span>
    <input type="text" class="to-account" value="${to}" placeholder="Mapped account">
    <button class="btn-delete" data-system="${system}" data-from="${from}">×</button>
  `;
  
  div.querySelector('.btn-delete').addEventListener('click', (e) => {
    deleteMapping(e.target.dataset.system, e.target.dataset.from);
  });
  
  return div;
}

// Add new mapping
function addMapping(system) {
  const container = document.getElementById(`${system}Mappings`);
  const mappingEl = createMappingElement(system, '', '');
  container.appendChild(mappingEl);
}

// Delete mapping
async function deleteMapping(system, from) {
  if (!confirm('Delete this mapping?')) return;
  
  try {
    const mappings = await StorageManager.getAccountMappings();
    delete mappings[system][from];
    await StorageManager.saveAccountMappings(mappings);
    renderMappings(system, mappings[system]);
    showMessage('Mapping deleted', 'success');
  } catch (error) {
    console.error('Failed to delete mapping:', error);
    showMessage('Failed to delete mapping', 'error');
  }
}

// Save settings
async function saveSettings() {
  try {
    // Collect R365 mappings
    const r365Mappings = {};
    document.querySelectorAll('#r365Mappings .mapping-item').forEach(item => {
      const from = item.querySelector('.from-account').value.trim();
      const to = item.querySelector('.to-account').value.trim();
      if (from && to) r365Mappings[from] = to;
    });
    
    // Collect Toast mappings
    const toastMappings = {};
    document.querySelectorAll('#toastMappings .mapping-item').forEach(item => {
      const from = item.querySelector('.from-account').value.trim();
      const to = item.querySelector('.to-account').value.trim();
      if (from && to) toastMappings[from] = to;
    });
    
    // Save account mappings
    await StorageManager.saveAccountMappings({
      r365: r365Mappings,
      toast: toastMappings
    });
    
    // Save comparison settings
    await StorageManager.saveSettings({
      minDifferenceAmount: parseFloat(document.getElementById('minDifference').value),
      autoExtract: document.getElementById('autoExtract').checked,
      showNotifications: document.getElementById('showNotifications').checked
    });
    
    // Save custom messages
    await StorageManager.saveCustomMessages({
      r365Only: document.getElementById('r365OnlyMsg').value,
      toastOnly: document.getElementById('toastOnlyMsg').value,
      amountDiff: document.getElementById('amountDiffMsg').value
    });
    
    showMessage('Settings saved successfully!', 'success');
    
  } catch (error) {
    console.error('Failed to save settings:', error);
    showMessage('Failed to save settings', 'error');
  }
}

// Reset settings to defaults
async function resetSettings() {
  if (!confirm('Reset all settings to defaults?')) return;
  
  try {
    await StorageManager.saveAccountMappings({ r365: {}, toast: {} });
    await StorageManager.saveSettings({
      minDifferenceAmount: 0.01,
      autoExtract: false,
      showNotifications: true
    });
    await StorageManager.saveCustomMessages({});
    
    await loadSettings();
    showMessage('Settings reset to defaults', 'success');
    
  } catch (error) {
    console.error('Failed to reset settings:', error);
    showMessage('Failed to reset settings', 'error');
  }
}

// Export data
async function exportData() {
  try {
    const data = await StorageManager.exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `haypka-data-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showMessage('Data exported successfully', 'success');
  } catch (error) {
    console.error('Failed to export data:', error);
    showMessage('Failed to export data', 'error');
  }
}

// Import data
async function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    await StorageManager.importData(text);
    await loadSettings();
    showMessage('Data imported successfully', 'success');
  } catch (error) {
    console.error('Failed to import data:', error);
    showMessage('Failed to import data', 'error');
  }
}

// Clear R365 data
async function clearR365Data() {
  if (!confirm('Clear all R365 data?')) return;
  
  try {
    await StorageManager.clearR365Data();
    showMessage('R365 data cleared', 'success');
  } catch (error) {
    console.error('Failed to clear R365 data:', error);
    showMessage('Failed to clear R365 data', 'error');
  }
}

// Clear Toast data
async function clearToastData() {
  if (!confirm('Clear all Toast data?')) return;
  
  try {
    await StorageManager.clearToastData();
    showMessage('Toast data cleared', 'success');
  } catch (error) {
    console.error('Failed to clear Toast data:', error);
    showMessage('Failed to clear Toast data', 'error');
  }
}

// Clear all data
async function clearAllData() {
  if (!confirm('Clear ALL data? This cannot be undone!')) return;
  
  try {
    await StorageManager.clearAllData();
    await loadSettings();
    showMessage('All data cleared', 'success');
  } catch (error) {
    console.error('Failed to clear all data:', error);
    showMessage('Failed to clear all data', 'error');
  }
}

// Show status message
function showMessage(message, type) {
  const messageEl = document.getElementById('statusMessage');
  messageEl.textContent = message;
  messageEl.className = `status-message ${type}`;
  messageEl.style.display = 'block';
  
  setTimeout(() => {
    messageEl.style.display = 'none';
  }, 5000);
}