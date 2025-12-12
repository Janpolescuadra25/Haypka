// R365 Scraper - Extracts data from Restaurant365 web pages
// This content script runs on R365 pages and extracts transaction data

console.log('R365 Scraper loaded');

// Configuration
const R365_CONFIG = {
  selectors: {
    // These selectors will need to be updated based on actual R365 HTML structure
    transactionRows: 'table tbody tr, .transaction-row, .journal-entry',
    date: '.date, [data-field="date"], td:nth-child(1)',
    account: '.account, [data-field="account"], td:nth-child(2)',
    description: '.description, [data-field="description"], td:nth-child(3)',
    debit: '.debit, [data-field="debit"], td:nth-child(4)',
    credit: '.credit, [data-field="credit"], td:nth-child(5)',
    reference: '.reference, [data-field="reference"], td:nth-child(6)'
  }
};

// Listen for extraction requests from popup/background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractR365Data') {
    extractR365Entries()
      .then(entries => {
        sendResponse({ success: true, entries: entries, count: entries.length });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep channel open for async response
  }
});

// Main extraction function
async function extractR365Entries() {
  console.log('Starting R365 data extraction...');
  
  const entries = [];
  const rows = document.querySelectorAll(R365_CONFIG.selectors.transactionRows);
  
  if (rows.length === 0) {
    throw new Error('No transaction rows found. Make sure you are on the correct R365 page.');
  }
  
  rows.forEach((row, index) => {
    try {
      const entry = extractEntryFromRow(row);
      if (entry && entry.account) { // Only add valid entries
        entries.push(entry);
      }
    } catch (error) {
      console.warn(`Failed to extract row ${index}:`, error);
    }
  });
  
  // Save to storage
  await saveEntries(entries);
  
  console.log(`Extracted ${entries.length} R365 entries`);
  return entries;
}

// Extract a single entry from a row element
function extractEntryFromRow(row) {
  const getText = (selector) => {
    const el = row.querySelector(selector);
    return el ? el.textContent.trim() : '';
  };
  
  const getAmount = (selector) => {
    const text = getText(selector);
    const amount = parseFloat(text.replace(/[$,]/g, ''));
    return isNaN(amount) ? 0 : amount;
  };
  
  const dateText = getText(R365_CONFIG.selectors.date);
  const account = getText(R365_CONFIG.selectors.account);
  const description = getText(R365_CONFIG.selectors.description);
  const debit = getAmount(R365_CONFIG.selectors.debit);
  const credit = getAmount(R365_CONFIG.selectors.credit);
  const reference = getText(R365_CONFIG.selectors.reference);
  
  // Parse date
  let parsedDate = '';
  try {
    const date = new Date(dateText);
    if (!isNaN(date.getTime())) {
      parsedDate = date.toISOString().split('T')[0]; // YYYY-MM-DD format
    }
  } catch (e) {
    console.warn('Failed to parse date:', dateText);
  }
  
  return {
    date: parsedDate || dateText,
    account: account,
    description: description,
    debit: debit,
    credit: credit,
    reference: reference,
    source: 'R365',
    extractedAt: new Date().toISOString(),
    amount: debit || credit // Total amount for comparison
  };
}

// Save entries to Chrome storage
async function saveEntries(entries) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['r365Entries'], (result) => {
      const existingEntries = result.r365Entries || [];
      const allEntries = [...existingEntries, ...entries];
      
      // Remove duplicates based on date, account, and amount
      const uniqueEntries = deduplicateEntries(allEntries);
      
      chrome.storage.local.set({ r365Entries: uniqueEntries }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(uniqueEntries);
        }
      });
    });
  });
}

// Remove duplicate entries
function deduplicateEntries(entries) {
  const seen = new Set();
  return entries.filter(entry => {
    const key = `${entry.date}-${entry.account}-${entry.amount}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

// Show notification to user
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 20px;
    background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
    color: white;
    border-radius: 4px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    z-index: 10000;
    font-family: Arial, sans-serif;
    font-size: 14px;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// Notify that scraper is ready
chrome.runtime.sendMessage({ 
  action: 'scraperReady', 
  source: 'R365',
  url: window.location.href
});
