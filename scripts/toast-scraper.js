// Toast POS Scraper - Extracts sales and transaction data from Toast POS web pages
// This content script runs on Toast pages and extracts transaction data

console.log('[Haypka] Toast POS Scraper loaded');

// ── Configuration ──────────────────────────────────────────────
const TOAST_CONFIG = {
  selectors: {
    transactionRows: 'table tbody tr, .transaction-row, .sales-row, [data-testid="transaction-row"]',
    date:        '.date, [data-field="date"], .transaction-date, td:nth-child(1)',
    category:    '.category, [data-field="category"], .item-category, td:nth-child(2)',
    description: '.description, [data-field="description"], .item-name, td:nth-child(3)',
    amount:      '.amount, [data-field="amount"], .total, .sales-amount, td:nth-child(4)',
    reference:   '.reference, [data-field="reference"], .order-id, td:nth-child(5)',
    paymentType: '.payment-type, [data-field="payment"], td:nth-child(6)',
  },
};

// ── Message listener ───────────────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractToastData') {
    extractToastEntries()
      .then(entries => sendResponse({ success: true, entries, count: entries.length }))
      .catch(error  => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// ── Main extraction ────────────────────────────────────────────
async function extractToastEntries() {
  console.log('[Toast Scraper] Starting data extraction…');

  const rows = document.querySelectorAll(TOAST_CONFIG.selectors.transactionRows);
  if (rows.length === 0) {
    throw new Error('No transaction rows found. Make sure you are on the correct Toast page.');
  }

  const rawEntries = [];
  rows.forEach((row, index) => {
    try {
      const entry = extractEntryFromRow(row);
      // Validate: must have a category (non-empty string)
      if (entry && entry.category) rawEntries.push(entry);
    } catch (err) {
      console.warn(`[Toast Scraper] Failed to extract row ${index}:`, err);
    }
  });

  // Convert to journal-entry format and save
  const journalEntries = convertToJournalEntries(rawEntries);
  await saveEntries(journalEntries);

  showNotification(`✔ Extracted ${journalEntries.length} Toast entries`, 'success');
  console.log(`[Toast Scraper] Extracted ${journalEntries.length} entries`);
  return journalEntries;
}

// ── Row parser ─────────────────────────────────────────────────
function extractEntryFromRow(row) {
  const getText = selector => {
    const el = row.querySelector(selector);
    return el ? el.textContent.trim() : '';
  };

  const getAmount = selector => {
    const text = getText(selector);
    let str = text.replace(/[$,\s]/g, '');
    const isNeg = str.startsWith('(') && str.endsWith(')');
    if (isNeg) str = '-' + str.slice(1, -1);
    const amount = parseFloat(str);
    return isNaN(amount) ? 0 : Math.abs(amount); // Toast amounts are always positive
  };

  const dateText   = getText(TOAST_CONFIG.selectors.date);
  const category   = getText(TOAST_CONFIG.selectors.category);
  const description = getText(TOAST_CONFIG.selectors.description);
  const amount     = getAmount(TOAST_CONFIG.selectors.amount);
  const reference  = getText(TOAST_CONFIG.selectors.reference);
  const paymentType = getText(TOAST_CONFIG.selectors.paymentType);

  let parsedDate = dateText;
  try {
    const d = new Date(dateText);
    if (!isNaN(d.getTime())) parsedDate = d.toISOString().split('T')[0];
  } catch (e) {
    console.warn('[Toast Scraper] Failed to parse date:', dateText);
  }

  return {
    date:        parsedDate,
    category,          // raw Toast category – used for dedup key BEFORE conversion
    description,
    amount,
    reference,
    paymentType,
    extractedAt: new Date().toISOString(),
  };
}

// ── Convert Toast entries to journal-entry format ──────────────
function convertToJournalEntries(toastEntries) {
  return toastEntries.map(entry => ({
    date:        entry.date,
    account:     entry.category || 'Sales', // map category → account
    description: entry.description,
    debit:       0,              // Revenue is a credit
    credit:      entry.amount,  // sales credit
    reference:   entry.reference,
    source:      'Toast',
    paymentType: entry.paymentType,
    extractedAt: entry.extractedAt,
    amount:      entry.amount,   // convenience field for comparison engine
    category:    entry.category, // retain original for dedup key
  }));
}

// ── Storage – replace strategy for same-page re-scraping ────────
// FIX: track the last scraped Toast URL to avoid silent doubling on re-runs.
async function saveEntries(newEntries) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['toastEntries', 'toastLastPageUrl'], result => {
      const currentUrl      = window.location.href;
      const lastUrl         = result.toastLastPageUrl || '';
      const existingEntries = result.toastEntries || [];

      const base = currentUrl === lastUrl ? [] : existingEntries;
      const uniqueEntries = deduplicateEntries([...base, ...newEntries]);

      chrome.storage.local.set(
        { toastEntries: uniqueEntries, toastLastPageUrl: currentUrl },
        () => {
          if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
          else resolve(uniqueEntries);
        }
      );
    });
  });
}

// ── Deduplication ──────────────────────────────────────────────
// FIX: key now uses `category` (the original Toast field), not `account`
// which may not be populated on the raw entry before conversion.
function deduplicateEntries(entries) {
  const seen = new Set();
  return entries.filter(entry => {
    // Use the most reliable available identifier
    const categoryKey = entry.category || entry.account || '';
    const key = `${entry.date}-${categoryKey}-${entry.amount}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── In-page notification ───────────────────────────────────────
function showNotification(message, type = 'info') {
  const colors = { success: '#4caf50', error: '#f44336', info: '#2196f3' };
  const n = document.createElement('div');
  n.style.cssText = `
    position: fixed; top: 20px; right: 20px;
    padding: 12px 20px;
    background: ${colors[type] || colors.info};
    color: #fff; border-radius: 6px;
    box-shadow: 0 3px 10px rgba(0,0,0,.25);
    z-index: 2147483647;
    font-family: system-ui, sans-serif; font-size: 14px;
    animation: haypkaFadeIn .2s ease;
  `;
  n.textContent = message;

  if (!document.getElementById('haypka-style')) {
    const style = document.createElement('style');
    style.id = 'haypka-style';
    style.textContent = '@keyframes haypkaFadeIn { from { opacity:0; transform:translateY(-8px) } to { opacity:1; transform:none } }';
    document.head.appendChild(style);
  }

  document.body.appendChild(n);
  setTimeout(() => n.remove(), 3500);
}

// ── Notify background that scraper is ready ────────────────────
chrome.runtime.sendMessage({
  action: 'scraperReady',
  source: 'Toast',
  url:    window.location.href,
});
