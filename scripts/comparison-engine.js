// Comparison Engine - Compares R365 and Toast entries to find differences

// ============================================================
// ACCOUNT MAPPING: Toast labels → R365 account patterns
// ============================================================
const TOAST_TO_R365_MAP = {
  // Payments
  'total cash': ['1000', 'cash'],
  'cash': ['1000', 'cash'],
  'credit/debit': ['1010', 'credit card', 'cc receivable'],
  'amex': ['1011', 'amex'],
  'discover': ['1012', 'discover'],
  'mastercard': ['1013', 'mastercard', 'mc'],
  'visa': ['1014', 'visa'],
  'gift card': ['1050', 'gift card'],
  // Third-party
  'doordash': ['1020', 'doordash'],
  'grubhub': ['1030', 'grubhub'],
  'ubereats': ['1040', 'ubereats'],
  // Revenue
  'net sales': ['5401', 'food sales', 'net revenue'],
  'gross sales': ['5400', 'gross sales'],
  'sales discounts': ['4200', 'discounts'],
  'sales refunds': ['4300', 'refunds'],
  // Menu items → revenue accounts
  'sandwiches': ['5401', 'food sales'],
  'sides': ['5401', 'food sales'],
  'soda': ['5405', 'soda', 'beverage'],
  'bar': ['5408', 'beer sales', '5409', 'liquor sales'],
  // Tax
  'tax amount': ['2201', 'sales tax'],
  'local tax': ['2202', 'local tax'],
  'state tax': ['2203', 'state tax'],
  'liquor tax': ['2203', 'liquor tax'],
  // Tips
  'total tips': ['2100', 'tips payable'],
  'tips collected': ['2100', 'tips payable'],
  // Discounts / voids
  'cash reward': ['4200', 'discounts'],
  'employee meal': ['4200', 'employee meal', 'discounts'],
  'void amount': ['4300', 'voids', 'refunds'],
};

// ============================================================
// HELPERS
// ============================================================

function _parseAmount(value) {
  if (typeof value === 'number') return Math.abs(value);
  if (!value || value === '—' || value === '-') return 0;
  return Math.abs(parseFloat(String(value).replace(/[$,]/g, '')) || 0);
}

function _normalizeAccount(account) {
  if (!account) return '';
  return String(account)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function _accountsMatch(toastLabel, r365Account) {
  const toastNorm = _normalizeAccount(toastLabel);
  const r365Norm = _normalizeAccount(r365Account);

  // 1. Direct exact match
  if (toastNorm === r365Norm) return true;

  // 2. Mapping table
  const targets = TOAST_TO_R365_MAP[toastNorm];
  if (targets) {
    for (const target of targets) {
      if (r365Norm.includes(target) || target.includes(r365Norm)) return true;
    }
  }

  // 3. Substring
  if (toastNorm.length > 3 && r365Norm.includes(toastNorm)) return true;
  if (r365Norm.length > 3 && toastNorm.includes(r365Norm)) return true;

  // 4. Word overlap
  const toastWords = toastNorm.split(' ');
  const r365Words = r365Norm.split(' ');
  const overlap = toastWords.filter(w => w.length > 2 && r365Words.includes(w));
  if (overlap.length >= 1) return true;

  return false;
}

function _amountsMatch(a, b, tolerancePercent = 0.01, minTolerance = 0.01) {
  if (a === 0 && b === 0) return { match: true, diff: 0 };
  if (a === 0 || b === 0) return { match: false, diff: Math.abs(a - b) };
  const diff = Math.abs(a - b);
  const maxTol = Math.max(minTolerance, Math.max(a, b) * tolerancePercent);
  return {
    match: diff <= maxTol,
    diff,
    diffPercent: (diff / Math.max(a, b)) * 100,
  };
}

function _similarityScore(toastEntry, r365Entry) {
  let score = 0;
  const toastLabel = toastEntry.account || '';
  const r365Account = r365Entry.account || '';

  // Account match (40 pts)
  if (_accountsMatch(toastLabel, r365Account)) {
    score += 40;
  } else {
    const toastWords = _normalizeAccount(toastLabel).split(' ');
    const r365Words = _normalizeAccount(r365Account).split(' ');
    const common = toastWords.filter(w => w.length > 2 && r365Words.includes(w));
    score += Math.min(20, common.length * 10);
  }

  // Amount match (40 pts)
  const toastAmt = toastEntry._amount || 0;
  const r365Amt = r365Entry._amount || 0;
  const amtResult = _amountsMatch(toastAmt, r365Amt, 0.05);
  if (amtResult.match) {
    score += 40;
  } else if (amtResult.diffPercent < 10) {
    score += 30;
  } else if (amtResult.diffPercent < 25) {
    score += 20;
  } else if (amtResult.diffPercent < 50) {
    score += 10;
  }

  // Type alignment (20 pts)
  const paymentKeywords = ['cash', 'credit', 'amex', 'visa', 'mastercard', 'discover', 'gift card', 'doordash', 'grubhub', 'ubereats'];
  const r365PaymentKeywords = ['1000', '1010', '1011', '1012', '1013', '1014', '1020', '1030', '1040', '1050', 'cash', 'receivable'];
  const toastIsPayment = paymentKeywords.some(k => toastLabel.toLowerCase().includes(k));
  const r365IsPayment = r365PaymentKeywords.some(k => r365Account.toLowerCase().includes(k));
  if (toastIsPayment === r365IsPayment) {
    score += 20;
  } else {
    score += 5;
  }

  return score;
}

// ============================================================
// COMPARISON ENGINE
// ============================================================

// Minimum similarity score for an entry pair to be considered a potential match
const MIN_CANDIDATE_SCORE = 50;
// Minimum similarity score for a match to be accepted
const MIN_ACCEPT_SCORE = 60;

class ComparisonEngine {
  constructor() {
    this.differences = [];
    this.matchedEntries = [];
  }

  // Main comparison function
  async compare() {
    const data = await this.loadData();

    if (!data.r365Entries || !data.toastEntries) {
      throw new Error('Missing data. Please extract data from both R365 and Toast first.');
    }

    const { r365Entries, toastEntries, accountMappings } = data;

    // Apply user-configured account mappings (manual overrides)
    const mappedR365 = this.applyMappings(r365Entries, accountMappings.r365 || {});
    const mappedToast = this.applyMappings(toastEntries, accountMappings.toast || {});

    // Find differences using fuzzy matching
    const result = this._fuzzyCompare(mappedToast, mappedR365);
    this.differences = result.differences;
    this.matchedEntries = result.matched;

    // Save results
    await this.saveResults();

    return {
      differences: this.differences,
      matched: this.matchedEntries,
      summary: this.getSummary()
    };
  }

  // Fuzzy comparison: match by account similarity + amount
  _fuzzyCompare(toastEntries, r365Entries) {
    const matched = [];
    const differences = [];
    const r365Used = new Set();
    const toastUsed = new Set();

    // Annotate with parsed amounts and indices
    const annotatedToast = toastEntries.map((e, i) => ({
      ...e,
      _index: i,
      _amount: _parseAmount(e.credit) || _parseAmount(e.debit) || _parseAmount(e.amount) || 0,
    })).filter(e => e._amount > 0);

    const annotatedR365 = r365Entries.map((e, i) => ({
      ...e,
      _index: i,
      _amount: _parseAmount(e.debit) || _parseAmount(e.credit) || _parseAmount(e.amount) || 0,
    })).filter(e => e._amount > 0);

    for (const toast of annotatedToast) {
      let bestMatch = null;
      let bestScore = 0;
      let bestAmtDiff = Infinity;

      for (const r365 of annotatedR365) {
        if (r365Used.has(r365._index)) continue;
        const score = _similarityScore(toast, r365);
        if (score < MIN_CANDIDATE_SCORE) continue;
        const amtDiff = Math.abs(toast._amount - r365._amount);
        if (score > bestScore || (score === bestScore && amtDiff < bestAmtDiff)) {
          bestScore = score;
          bestMatch = r365;
          bestAmtDiff = amtDiff;
        }
      }

      if (bestMatch && bestScore >= MIN_ACCEPT_SCORE) {
        const amtResult = _amountsMatch(toast._amount, bestMatch._amount);
        const toastClean = { ...toast };
        const r365Clean = { ...bestMatch };
        delete toastClean._index; delete toastClean._amount;
        delete r365Clean._index; delete r365Clean._amount;

        if (amtResult.match) {
          matched.push({
            type: 'MATCHED',
            r365Entry: r365Clean,
            toastEntry: toastClean,
            difference: 0,
            account: bestMatch.account,
            date: bestMatch.date,
          });
        } else {
          differences.push({
            type: 'AMOUNT_DIFFERENCE',
            r365Entry: r365Clean,
            toastEntry: toastClean,
            difference: amtResult.diff,
            account: bestMatch.account,
            date: bestMatch.date,
            toastAmount: toast._amount,
            r365Amount: bestMatch._amount,
          });
        }

        r365Used.add(bestMatch._index);
        toastUsed.add(toast._index);
      }
    }

    // Unmatched Toast entries
    annotatedToast
      .filter(e => !toastUsed.has(e._index))
      .forEach(e => {
        const clean = { ...e };
        delete clean._index; delete clean._amount;
        differences.push({
          type: 'TOAST_ONLY',
          toastEntry: clean,
          difference: e._amount,
          account: e.account,
          date: e.date,
        });
      });

    // Unmatched R365 entries
    annotatedR365
      .filter(e => !r365Used.has(e._index))
      .forEach(e => {
        const clean = { ...e };
        delete clean._index; delete clean._amount;
        differences.push({
          type: 'R365_ONLY',
          r365Entry: clean,
          difference: e._amount,
          account: e.account,
          date: e.date,
        });
      });

    return { matched, differences };
  }

  // Apply user-configured account mappings
  applyMappings(entries, mappings) {
    return entries.map(entry => ({
      ...entry,
      account: mappings[entry.account] || entry.account
    }));
  }

  // Get summary statistics
  getSummary() {
    const totalDifference = this.differences.reduce((sum, diff) => sum + diff.difference, 0);

    return {
      totalDifferences: this.differences.length,
      totalMatched: this.matchedEntries.length,
      totalVariance: Math.round(totalDifference * 100) / 100,
      r365Only: this.differences.filter(d => d.type === 'R365_ONLY').length,
      toastOnly: this.differences.filter(d => d.type === 'TOAST_ONLY').length,
      amountDiffs: this.differences.filter(d => d.type === 'AMOUNT_DIFFERENCE').length
    };
  }

  // Load data from storage
  async loadData() {
    return new Promise((resolve) => {
      chrome.storage.local.get([
        'r365Entries',
        'toastEntries',
        'accountMappings'
      ], (result) => {
        resolve(result);
      });
    });
  }

  // Save comparison results
  async saveResults() {
    return new Promise((resolve) => {
      chrome.storage.local.set({
        comparisonResults: {
          differences: this.differences,
          matched: this.matchedEntries,
          summary: this.getSummary(),
          lastCompared: new Date().toISOString()
        }
      }, resolve);
    });
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  window.ComparisonEngine = ComparisonEngine;
}
