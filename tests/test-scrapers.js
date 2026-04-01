/**
 * Test Suite: Scraper Helper Functions
 *
 * Tests pure helper logic from r365-scraper.js and toast-scraper.js
 * WITHOUT needing a real DOM page or chrome.tabs.
 * We replicate and exercise the individual functions here.
 */

// ──────────────────────────────────────────────────────────────
// Pure function copies (no DOM/chrome dependency)
// ──────────────────────────────────────────────────────────────

/** Shared amount parser used in both scrapers */
function parseAmount(text, allowNegative = false) {
  // Handle parenthetical negatives like (1,234.56)
  let str = String(text).replace(/[$,\s]/g, '');
  const isParenNegative = str.startsWith('(') && str.endsWith(')');
  if (isParenNegative) str = '-' + str.slice(1, -1);
  const amount = parseFloat(str);
  if (isNaN(amount)) return 0;
  return allowNegative ? amount : Math.abs(amount);
}

/** R365 deduplication key */
function r365DedupeKey(entry) {
  return `${entry.date}-${entry.account}-${entry.amount}`;
}

/** Toast deduplication key (FIXED: uses category, not account) */
function toastDedupeKey(entry) {
  return `${entry.date}-${entry.category || entry.account}-${entry.amount}`;
}

/** Deduplication (generic) */
function deduplicateEntries(entries, keyFn) {
  const seen = new Set();
  return entries.filter(entry => {
    const key = keyFn(entry);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Toast convertToJournalEntries */
function convertToJournalEntries(toastEntries) {
  return toastEntries.map(entry => ({
    date: entry.date,
    account: entry.category || 'Sales',
    description: entry.description,
    debit: 0,
    credit: entry.amount,
    reference: entry.reference,
    source: 'Toast',
    paymentType: entry.paymentType,
    extractedAt: entry.extractedAt,
    amount: entry.amount,
  }));
}

/** Date parser shared by both scrapers */
function parseEntryDate(dateText) {
  try {
    const date = new Date(dateText);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch (e) { /* ignore */ }
  return dateText; // fall back to raw string
}

// ──────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────

suite('Scrapers – Amount Parser', async (test) => {

  await test('parses plain integer', async (assert) => {
    assert.closeTo(parseAmount('1500'), 1500);
  });

  await test('parses decimal', async (assert) => {
    assert.closeTo(parseAmount('12.50'), 12.50);
  });

  await test('strips dollar sign', async (assert) => {
    assert.closeTo(parseAmount('$99.99'), 99.99);
  });

  await test('strips commas from large amounts', async (assert) => {
    assert.closeTo(parseAmount('$1,234.56'), 1234.56);
  });

  await test('returns absolute value (negative input)', async (assert) => {
    assert.closeTo(parseAmount('-50.00'), 50);
  });

  await test('parses parenthetical negatives as positive (abs)', async (assert) => {
    assert.closeTo(parseAmount('(1,234.56)'), 1234.56);
  });

  await test('returns 0 for non-numeric string', async (assert) => {
    assert.closeTo(parseAmount('N/A'), 0);
  });

  await test('returns 0 for empty string', async (assert) => {
    assert.closeTo(parseAmount(''), 0);
  });

  await test('handles amount with spaces', async (assert) => {
    assert.closeTo(parseAmount(' $500.00 '), 500);
  });
});

suite('Scrapers – Deduplication', async (test) => {

  await test('R365 dedup – removes exact duplicate', async (assert) => {
    const entries = [
      { date: '2025-01-01', account: 'Cash', amount: 1000 },
      { date: '2025-01-01', account: 'Cash', amount: 1000 }, // duplicate
    ];
    const result = deduplicateEntries(entries, r365DedupeKey);
    assert.length(result, 1);
  });

  await test('R365 dedup – keeps entries with different amounts', async (assert) => {
    const entries = [
      { date: '2025-01-01', account: 'Cash', amount: 1000 },
      { date: '2025-01-01', account: 'Cash', amount: 500 },
    ];
    const result = deduplicateEntries(entries, r365DedupeKey);
    assert.length(result, 2);
  });

  await test('R365 dedup – keeps entries with different dates', async (assert) => {
    const entries = [
      { date: '2025-01-01', account: 'Cash', amount: 1000 },
      { date: '2025-01-02', account: 'Cash', amount: 1000 },
    ];
    const result = deduplicateEntries(entries, r365DedupeKey);
    assert.length(result, 2);
  });

  await test('Toast dedup – uses category field (not account)', async (assert) => {
    // Bug fix test: before fix, both would be kept because account may be undefined
    const entries = [
      { date: '2025-01-01', category: 'Food', amount: 200 },
      { date: '2025-01-01', category: 'Food', amount: 200 }, // duplicate
    ];
    const result = deduplicateEntries(entries, toastDedupeKey);
    assert.length(result, 1, 'Should deduplicate by category, not account');
  });

  await test('Toast dedup – different categories are kept', async (assert) => {
    const entries = [
      { date: '2025-01-01', category: 'Food', amount: 200 },
      { date: '2025-01-01', category: 'Beverage', amount: 200 },
    ];
    const result = deduplicateEntries(entries, toastDedupeKey);
    assert.length(result, 2);
  });

  await test('dedup – empty array returns empty array', async (assert) => {
    const result = deduplicateEntries([], r365DedupeKey);
    assert.equal(result, []);
  });

  await test('dedup – preserves order (first occurrence wins)', async (assert) => {
    const entries = [
      { date: '2025-01-01', account: 'A', amount: 100 },
      { date: '2025-01-01', account: 'B', amount: 200 },
      { date: '2025-01-01', account: 'A', amount: 100 }, // dup of first
    ];
    const result = deduplicateEntries(entries, r365DedupeKey);
    assert.length(result, 2);
    assert.equal(result[0].account, 'A');
    assert.equal(result[1].account, 'B');
  });
});

suite('Scrapers – Toast convertToJournalEntries', async (test) => {

  await test('maps category to account field', async (assert) => {
    const toastEntry = { date: '2025-01-01', category: 'Food Sales', description: 'Dinner', amount: 500, reference: 'ORD-001', paymentType: 'Credit', extractedAt: '2025-01-01T00:00:00Z' };
    const journals = convertToJournalEntries([toastEntry]);
    assert.length(journals, 1);
    assert.equal(journals[0].account, 'Food Sales');
  });

  await test('falls back account to "Sales" when category is empty', async (assert) => {
    const toastEntry = { date: '2025-01-01', category: '', description: '', amount: 100, reference: '', paymentType: '', extractedAt: '' };
    const journals = convertToJournalEntries([toastEntry]);
    assert.equal(journals[0].account, 'Sales');
  });

  await test('sets debit to 0 and credit to amount (revenue credit accounting)', async (assert) => {
    const toastEntry = { date: '2025-01-01', category: 'Bar', amount: 300, description: '', reference: '', paymentType: '', extractedAt: '' };
    const journals = convertToJournalEntries([toastEntry]);
    assert.equal(journals[0].debit, 0);
    assert.closeTo(journals[0].credit, 300);
  });

  await test('sets source to "Toast"', async (assert) => {
    const toastEntry = { date: '2025-01-01', category: 'Bar', amount: 100, description: '', reference: '', paymentType: '', extractedAt: '' };
    const journals = convertToJournalEntries([toastEntry]);
    assert.equal(journals[0].source, 'Toast');
  });

  await test('preserves paymentType', async (assert) => {
    const toastEntry = { date: '2025-01-01', category: 'Bar', amount: 100, description: '', reference: '', paymentType: 'Cash', extractedAt: '' };
    const journals = convertToJournalEntries([toastEntry]);
    assert.equal(journals[0].paymentType, 'Cash');
  });

  await test('handles empty array', async (assert) => {
    const journals = convertToJournalEntries([]);
    assert.equal(journals, []);
  });

  await test('amount field matches credit field', async (assert) => {
    const toastEntry = { date: '2025-01-01', category: 'Retail', amount: 750, description: '', reference: '', paymentType: '', extractedAt: '' };
    const journals = convertToJournalEntries([toastEntry]);
    assert.closeTo(journals[0].amount, journals[0].credit);
  });
});

suite('Scrapers – Date Parser', async (test) => {

  await test('parses ISO date string', async (assert) => {
    assert.equal(parseEntryDate('2025-01-15'), '2025-01-15');
  });

  await test('parses US date format (Jan 15, 2025)', async (assert) => {
    const result = parseEntryDate('Jan 15, 2025');
    assert.ok(result.startsWith('2025-01-'), `Expected YYYY-01-* but got ${result}`);
  });

  await test('parses slash-delimited date (01/15/2025)', async (assert) => {
    const result = parseEntryDate('01/15/2025');
    assert.ok(result.startsWith('2025'), `Expected year 2025 in result but got ${result}`);
  });

  await test('falls back to raw string for unparseable date', async (assert) => {
    const raw = 'not-a-date';
    const result = parseEntryDate(raw);
    assert.equal(result, raw);
  });

  await test('parses datetime string (strips time part)', async (assert) => {
    const result = parseEntryDate('2025-03-20T14:30:00Z');
    assert.equal(result, '2025-03-20');
  });
});
