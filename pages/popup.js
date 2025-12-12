// Popup.js - Main popup interface logic

document.addEventListener('DOMContentLoaded', async () => {
  await loadStatus();
  setupEventListeners();
});

// Load current status
async function loadStatus() {
  try {
    const r365Entries = await StorageManager.getR365Entries();
    const toastEntries = await StorageManager.getToastEntries();
    const comparisonResults = await StorageManager.getComparisonResults();

    document.getElementById('r365Count').textContent = r365Entries.length;
    document.getElementById('toastCount').textContent = toastEntries.length;

    if (comparisonResults) {
      document.getElementById('summarySection').style.display = 'block';
      document.getElementById('diffCount').textContent = comparisonResults.summary.totalDifferences;
      document.getElementById('matchCount').textContent = comparisonResults.summary.totalMatched;
      document.getElementById('variance').textContent = comparisonResults.summary.totalVariance.toFixed(2);
    }
  } catch (error) {
    console.error('Failed to load status:', error);
  }
}

// Setup event listeners
function setupEventListeners() {
  document.getElementById('extractR365Btn').addEventListener('click', extractR365Data);
  document.getElementById('extractToastBtn').addEventListener('click', extractToastData);
  document.getElementById('compareBtn').addEventListener('click', compareData);
  document.getElementById('dashboardBtn').addEventListener('click', openDashboard);
  document.getElementById('settingsBtn').addEventListener('click', openSettings);
}

// Extract R365 data
async function extractR365Data() {
  showMessage('Extracting R365 data...', 'info');
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.url.includes('restaurant365.com')) {
      showMessage('Please navigate to a Restaurant365 page first', 'error');
      return;
    }

    const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractR365Data' });
    
    if (response.success) {
      showMessage(`Successfully extracted ${response.count} R365 entries`, 'success');
      await loadStatus();
    } else {
      showMessage(`Error: ${response.error}`, 'error');
    }
  } catch (error) {
    showMessage('Failed to extract R365 data. Make sure you are on the correct page.', 'error');
    console.error(error);
  }
}

// Extract Toast data
async function extractToastData() {
  showMessage('Extracting Toast data...', 'info');
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.url.includes('toasttab.com')) {
      showMessage('Please navigate to a Toast POS page first', 'error');
      return;
    }

    const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractToastData' });
    
    if (response.success) {
      showMessage(`Successfully extracted ${response.count} Toast entries`, 'success');
      await loadStatus();
    } else {
      showMessage(`Error: ${response.error}`, 'error');
    }
  } catch (error) {
    showMessage('Failed to extract Toast data. Make sure you are on the correct page.', 'error');
    console.error(error);
  }
}

// Compare data
async function compareData() {
  showMessage('Comparing entries...', 'info');
  
  try {
    const engine = new ComparisonEngine();
    const results = await engine.compare();
    
    showMessage(`Comparison complete! Found ${results.summary.totalDifferences} differences`, 'success');
    await loadStatus();
    
    // Auto-open dashboard if differences found
    if (results.summary.totalDifferences > 0) {
      setTimeout(() => openDashboard(), 1000);
    }
  } catch (error) {
    showMessage(`Error: ${error.message}`, 'error');
    console.error(error);
  }
}

// Open dashboard
function openDashboard() {
  chrome.tabs.create({ url: chrome.runtime.getURL('pages/dashboard.html') });
}

// Open settings
function openSettings() {
  chrome.tabs.create({ url: chrome.runtime.getURL('pages/settings.html') });
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