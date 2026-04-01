// R365 Scraper - Extracts data from Restaurant365 web pages
// This content script runs on R365 pages and extracts transaction data

console.log('[Haypka] R365 Scraper loaded');

// ── Configuration ──────────────────────────────────────────────
const R365_CONFIG = {
  selectors: {
    // These selectors cover common R365 table layouts.
    // Update based on the actual R365 page you target.
    transactionRows: 'table tbody tr, .transaction-row, .journal-entry',
    date:        '.date, [data-field="date"], td:nth-child(1)',
    account:     '.account, [data-field="account"], td:nth-child(2)',
    description: '.description, [data-field="description"], td:nth-child(3)',
    debit:       '.debit, [data-field="debit"], td:nth-child(4)',
    credit:      '.credit, [data-field="credit"], td:nth-child(5)',
    reference:   '.reference, [data-field="reference"], td:nth-child(6)',
  },
};

// ── Message listener ───────────────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractR365Data') {
    extractR365Entries()
      .then(entries => sendResponse({ success: true, entries, count: entries.length }))
      .catch(error  => sendResponse({ success: false, error: error.message }));
    return true; // Keep the channel open for async response
  }
});

// ── Main extraction ────────────────────────────────────────────
async function extractR365Entries() {
  console.log('[R365 Scraper] Starting data extraction…');

  const rows = document.querySelectorAll(R365_CONFIG.selectors.transactionRows);
  if (rows.length === 0) {
    throw new Error('No transaction rows found. Make sure you are on the correct R365 page.');
  }

  const entries = [];
  rows.forEach((row, index) => {
    try {
      const entry = extractEntryFromRow(row);
      if (entry && entry.account) entries.push(entry);
    } catch (err) {
      console.warn(`[R365 Scraper] Failed to extract row ${index}:`, err);
    }
  });

  await saveEntries(entries);
  showNotification(`✔ Extracted ${entries.length} R365 entries`, 'success');
  console.log(`[R365 Scraper] Extracted ${entries.length} entries`);
  return entries;
}

// ── Row parser ─────────────────────────────────────────────────
function extractEntryFromRow(row) {
  const getText = selector => {
    const el = row.querySelector(selector);
    return el ? el.textContent.trim() : '';
  };

  const getAmount = selector => {
    const text = getText(selector);
    // Strip $, commas, spaces; handle parenthetical negatives
    let str = text.replace(/[$,\s]/g, '');
    const isNeg = str.startsWith('(') && str.endsWith(')');
    if (isNeg) str = '-' + str.slice(1, -1);
    const amount = parseFloat(str);
    return isNaN(amount) ? 0 : amount;
  };

  const dateText = getText(R365_CONFIG.selectors.date);
  const account  = getText(R365_CONFIG.selectors.account);
  const desc     = getText(R365_CONFIG.selectors.description);
  const debit    = getAmount(R365_CONFIG.selectors.debit);
  const credit   = getAmount(R365_CONFIG.selectors.credit);
  const reference = getText(R365_CONFIG.selectors.reference);

  // Parse date to YYYY-MM-DD
  let parsedDate = dateText;
  try {
    const d = new Date(dateText);
    if (!isNaN(d.getTime())) parsedDate = d.toISOString().split('T')[0];
  } catch (e) {
    console.warn('[R365 Scraper] Failed to parse date:', dateText);
  }

  return {
    date:        parsedDate,
    account,
    description: desc,
    debit,
    credit,
    reference,
    source:      'R365',
    extractedAt: new Date().toISOString(),
    amount:      debit || credit, // primary amount for comparison
  };
}

// ── Storage – replace strategy for same-page re-scraping ────────
// FIX: instead of always appending, we track the last scraped URL.
// If you scrape the same URL again, existing entries from that URL
// are replaced rather than duplicated.
async function saveEntries(newEntries) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['r365Entries', 'r365LastPageUrl'], result => {
      const currentUrl     = window.location.href;
      const lastUrl        = result.r365LastPageUrl || '';
      const existingEntries = result.r365Entries || [];

      // If same page → replace; otherwise → merge with dedup
      const base = currentUrl === lastUrl ? [] : existingEntries;
      const uniqueEntries = deduplicateEntries([...base, ...newEntries]);

      chrome.storage.local.set(
        { r365Entries: uniqueEntries, r365LastPageUrl: currentUrl },
        () => {
          if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
          else resolve(uniqueEntries);
        }
      );
    });
  });
}

// ── Deduplication ──────────────────────────────────────────────
function deduplicateEntries(entries) {
  const seen = new Set();
  return entries.filter(entry => {
    const key = `${entry.date}-${entry.account}-${entry.amount}`;
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

  // Inject keyframe if not present
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
  source: 'R365',
  url:    window.location.href,
});
