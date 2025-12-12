// Toast POS Scraper - Extracts sales and transaction data from Toast POS web pages
// This content script runs on Toast pages and extracts transaction data

console.log('Toast POS Scraper loaded');

// Configuration
const TOAST_CONFIG = {
  selectors: {
    // These selectors will need to be updated based on actual Toast HTML structure
    transactionRows: 'table tbody tr, .transaction-row, .sales-row, [data-testid="transaction-row"]',
    date: '.date, [data-field="date"], .transaction-date, td:nth-child(1)',
    category: '.category, [data-field="category"], .item-category, td:nth-child(2)',
    description: '.description, [data-field="description"], .item-name, td:nth-child(3)',
    amount: '.amount, [data-field="amount"], .total, .sales-amount, td:nth-child(4)',
    reference: '.reference, [data-field="reference"], .order-id, td:nth-child(5)',
    paymentType: '.payment-type, [data-field="payment"], td:nth-child(6)'
  }
};

// Listen for extraction requests from popup/background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractToastData') {
    extractToastEntries()
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
async function extractToastEntries() {
  console.log('Starting Toast POS data extraction...');
  
  const entries = [];
  const rows = document.querySelectorAll(TOAST_CONFIG.selectors.transactionRows);
  
  if (rows.length === 0) {
    throw new Error('No transaction rows found. Make sure you are on the correct Toast page.');
  }
  
  rows.forEach((row, index) => {
    try {
      const entry = extractEntryFromRow(row);
      if (entry && entry.category) { // Only add valid entries
        entries.push(entry);
      }
    } catch (error) {
      console.warn(`Failed to extract row ${index}:`, error);
    }
  });
  
  // Convert to journal entry format
  const journalEntries = convertToJournalEntries(entries);
  
  // Save to storage
  await saveEntries(journalEntries);
  
  console.log(`Extracted ${journalEntries.length} Toast entries`);
  return journalEntries;
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
    return isNaN(amount) ? 0 : Math.abs(amount);
  };
  
  const dateText = getText(TOAST_CONFIG.selectors.date);
  const category = getText(TOAST_CONFIG.selectors.category);
  const description = getText(TOAST_CONFIG.selectors.description);
  const amount = getAmount(TOAST_CONFIG.selectors.amount);
  const reference = getText(TOAST_CONFIG.selectors.reference);
  const paymentType = getText(TOAST_CONFIG.selectors.paymentType);
  
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
    category: category,
    description: description,
    amount: amount,
    reference: reference,
    paymentType: paymentType,
    extractedAt: new Date().toISOString()
  };
}

// Convert Toast entries to journal entry format
function convertToJournalEntries(toastEntries) {
  return toastEntries.map(entry => {
    // For Toast, sales are typically credits (revenue)
    // Debit would be Cash/AR, Credit would be Sales/Revenue
    return {
      date: entry.date,
      account: entry.category || 'Sales',
      description: entry.description,
      debit: 0, // Cash/AR debit would be determined by payment type
      credit: entry.amount, // Revenue credit
      reference: entry.reference,
      source: 'Toast',
      paymentType: entry.paymentType,
      extractedAt: entry.extractedAt,
      amount: entry.amount // Total amount for comparison
    };
  });
}

// Save entries to Chrome storage
async function saveEntries(entries) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['toastEntries'], (result) => {
      const existingEntries = result.toastEntries || [];
      const allEntries = [...existingEntries, ...entries];
      
      // Remove duplicates based on date, account, and amount
      const uniqueEntries = deduplicateEntries(allEntries);
      
      chrome.storage.local.set({ toastEntries: uniqueEntries }, () => {
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
  source: 'Toast',
  url: window.location.href
});
