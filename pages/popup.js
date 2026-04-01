// Popup.js - Main popup interface logic

document.addEventListener('DOMContentLoaded', async () => {
  await loadStatus();
  setupEventListeners();
});

// ── Load current status ────────────────────────────────────────
async function loadStatus() {
  try {
    const r365Entries       = await StorageManager.getR365Entries();
    const toastEntries      = await StorageManager.getToastEntries();
    const comparisonResults = await StorageManager.getComparisonResults();

    document.getElementById('r365Count').textContent   = r365Entries.length;
    document.getElementById('toastCount').textContent  = toastEntries.length;

    if (comparisonResults) {
      document.getElementById('summarySection').style.display = 'block';
      document.getElementById('diffCount').textContent  = comparisonResults.summary.totalDifferences;
      document.getElementById('matchCount').textContent = comparisonResults.summary.totalMatched;
      document.getElementById('variance').textContent   = comparisonResults.summary.totalVariance.toFixed(2);
    }
  } catch (error) {
    console.error('[Popup] Failed to load status:', error);
  }
}

// ── Event listeners ────────────────────────────────────────────
function setupEventListeners() {
  document.getElementById('extractR365Btn').addEventListener('click',  extractR365Data);
  document.getElementById('extractToastBtn').addEventListener('click', extractToastData);
  document.getElementById('compareBtn').addEventListener('click',      compareData);
  document.getElementById('dashboardBtn').addEventListener('click',    openDashboard);
  document.getElementById('settingsBtn').addEventListener('click',     openSettings);
}

// ── URL validation helpers ─────────────────────────────────────
// FIX: Use URL object to validate hostname – prevents matching
// adversarial domains like "evil-restaurant365.com".
function isR365Tab(tab) {
  try {
    return new URL(tab.url).hostname.endsWith('restaurant365.com');
  } catch { return false; }
}

function isToastTab(tab) {
  try {
    return new URL(tab.url).hostname.endsWith('toasttab.com');
  } catch { return false; }
}

// ── Extract R365 data ──────────────────────────────────────────
async function extractR365Data() {
  showMessage('Extracting R365 data…', 'info');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!isR365Tab(tab)) {
      showMessage('Please navigate to a Restaurant365 page first', 'error');
      return;
    }

    const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractR365Data' });

    if (response && response.success) {
      showMessage(`✔ Extracted ${response.count} R365 entries`, 'success');
      await loadStatus();
    } else {
      showMessage(`Error: ${response?.error || 'Unknown error'}`, 'error');
    }
  } catch (error) {
    showMessage('Failed to extract R365 data. Make sure you are on the correct page.', 'error');
    console.error('[Popup] R365 extraction error:', error);
  }
}

// ── Extract Toast data ─────────────────────────────────────────
async function extractToastData() {
  showMessage('Extracting Toast data…', 'info');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!isToastTab(tab)) {
      showMessage('Please navigate to a Toast POS page first', 'error');
      return;
    }

    const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractToastData' });

    if (response && response.success) {
      showMessage(`✔ Extracted ${response.count} Toast entries`, 'success');
      await loadStatus();
    } else {
      showMessage(`Error: ${response?.error || 'Unknown error'}`, 'error');
    }
  } catch (error) {
    showMessage('Failed to extract Toast data. Make sure you are on the correct page.', 'error');
    console.error('[Popup] Toast extraction error:', error);
  }
}

// ── Compare data ───────────────────────────────────────────────
async function compareData() {
  showMessage('Comparing entries…', 'info');

  try {
    const engine  = new ComparisonEngine();
    const results = await engine.compare();

    const count = results.summary.totalDifferences;
    showMessage(`✔ Comparison complete! Found ${count} difference${count !== 1 ? 's' : ''}`, 'success');
    await loadStatus();

    // Auto-open dashboard when differences exist
    if (count > 0) {
      setTimeout(() => openDashboard(), 1000);
    }
  } catch (error) {
    showMessage(`Error: ${error.message}`, 'error');
    console.error('[Popup] Comparison error:', error);
  }
}

// ── Navigation ─────────────────────────────────────────────────
function openDashboard() {
  chrome.tabs.create({ url: chrome.runtime.getURL('pages/dashboard.html') });
}

function openSettings() {
  chrome.tabs.create({ url: chrome.runtime.getURL('pages/settings.html') });
}

// ── Status messaging ───────────────────────────────────────────
function showMessage(message, type) {
  const el = document.getElementById('statusMessage');
  el.textContent = message;
  el.className   = `status-message ${type}`;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 5000);
}