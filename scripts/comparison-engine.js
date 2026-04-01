// Comparison Engine - Compares R365 and Toast entries to find differences

// ─── Toast → R365 Account Mapping ────────────────────────────────────────────
const TOAST_TO_R365_MAP = {
  // MENU CATEGORIES → R365 Revenue (amount is in paymentType field)
  'beer': ['5208', 'beer sales'],
  'food': ['5101', 'food sales'],
  'liquor': ['5207', 'liquor sales'],
  'na beverage': ['5212', 'beverage'],
  'wine': ['5206', 'wine sales'],
  'non-grat svc charges': ['5499', 'kitchen service charge'],
  'kitchen service charge': ['5499', 'kitchen service charge'],

  // TAX BREAKDOWN → R365 Tax (amount is in description field)
  'liquor tax': ['2203', 'liquor tax'],
  'pa county tax': ['2202', 'local tax'],
  'pa state tax': ['2201', 'state tax'],
  'tax amount': ['2201', 'tax'],

  // DISCOUNTS/VOIDS → R365 Discounts (amount is in description field)
  'employee discount': ['5471', 'employee discount'],
  'manager meal': ['5473', 'manager discount'],
  'manager discount': ['5473', 'manager discount'],
  'goodwill': ['5475', 'open discount'],
  'open discount': ['5475', 'open discount'],
  'spill': ['5472', 'errors', 'mistakes', 'dnl'],
  'errors/mistakes/dnl': ['5472', 'errors'],
  'staff training': ['5454', 'training', 'tasting'],
  'tasting / training': ['5454', 'training'],
  'cash reward': ['cash reward'],
  'donation': ['gift card'],
  'void amount': ['void'],

  // PAYMENTS → R365 Asset accounts (amount is in account field)
  'total cash': ['cash', 'undeposited'],
  'actual deposit': ['1802', 'undeposited'],
  'credit/debit': ['1802', 'undeposited'],
  'amex': ['amex'],
  'discover': ['discover'],
  'mastercard': ['mastercard'],
  'visa': ['visa'],
  'gift card': ['2300', 'gift card'],
  'deferred (gift cards)': ['2300', 'gift card'],
  'cash': ['cash'],

  // SUMMARY → R365 (amount is in account field)
  'net sales': ['5101', 'food sales'],
  'total tips': ['2106', 'tips'],
  'tips': ['2106', 'tips'],

  // SKIP THESE - not financial reconciliation data
  'total guests': null,
  'avg/guest': null,
  'total payments': null,
  'avg/payment': null,
  'total orders': null,
  'avg/order': null,
  'turn time': null,
  'void order count': null,
  'void item count': null,
  'void amount %': null,
  'gross sales': null,
  'sales discounts': null,
  'sales refunds': null,
  'gratuity': null,
  'total amount': null,
  'paid in total': null,
  'unpaid amount': null,
  'tips collected': null,
  'tips refunded': null,
  'non taxable': null,
  'expected closeout cash': null,
  'actual closeout cash': null,
  'cash overage/shortage': null,
  'expected deposit': null,
  'deposit overage/shortage': null,
  'total cash payments': null,
  'cash adjustments': null,
  'cash refunds': null,
  'cash before tipouts': null,
  'tipouts tips withheld': null,
  'dining room': null,
  'dine in': null,
  'no dining option': null,
  'dinner': null,
  'lunch': null,
  'no service': null,
  'e-gift cards': null,
  'other': null,
  'total': null,
};

// ─── Helper Functions ─────────────────────────────────────────────────────────

function _parseDollar(str) {
  if (!str) return 0;
  const num = parseFloat(String(str).replace(/[$,]/g, ''));
  return isNaN(num) ? 0 : num;
}

function _getToastCandidateAmounts(entry) {
  const candidates = [];
  if (entry.account && String(entry.account).startsWith('$'))
    candidates.push(_parseDollar(String(entry.account)));
  if (entry.description && String(entry.description).startsWith('$'))
    candidates.push(_parseDollar(String(entry.description)));
  if (entry.paymentType && String(entry.paymentType).startsWith('$'))
    candidates.push(_parseDollar(String(entry.paymentType)));
  if (entry.amount > 0)
    candidates.push(entry.amount);
  return candidates;
}

function _amountsMatch(a, b) {
  if (a === 0 && b === 0) return { match: true, diffPercent: 0 };
  if (a === 0 || b === 0) return { match: false, diffPercent: 100 };
  const diff = Math.abs(a - b);
  const larger = Math.max(Math.abs(a), Math.abs(b));
  const diffPercent = (diff / larger) * 100;
  return { match: diff < 0.01, diffPercent };
}

// Strip tooltip text concatenated to Toast labels by matching known map keys as prefixes.
function _cleanToastLabel(rawLabel) {
  if (!rawLabel) return '';
  const lower = rawLabel.toLowerCase();
  for (const key of Object.keys(TOAST_TO_R365_MAP)) {
    if (lower.startsWith(key) && TOAST_TO_R365_MAP[key] !== null) return key;
  }
  return lower.trim();
}

// Normalize R365 and Toast entries for comparison.
// R365: deduplicate accounts that appear in two formats; derive _label and _amount.
// Toast: clean labels, skip null/zero-amount rows; derive _label and _candidates.
function _annotateEntries(r365Entries, toastEntries) {
  // Annotate R365 entries and deduplicate by account label
  const r365Map = new Map();
  for (const entry of r365Entries) {
    const rawAcct = String(entry.account || '');
    const rawDate = String(entry.date || '');
    // When account holds a dollar string the label lives in the date field (Format A)
    const label = rawAcct.startsWith('$')
      ? rawDate.toLowerCase().trim()
      : rawAcct.toLowerCase().trim();
    const amount = entry.amount > 0 ? entry.amount : _parseDollar(rawAcct);
    const annotated = { ...entry, _label: label, _amount: amount };

    if (r365Map.has(label)) {
      const existing = r365Map.get(label);
      // Keep Format B (amount field > 0); if both are 0 prefer the one with $ in account
      if (entry.amount > existing._sourceAmount ||
          (entry.amount === 0 && existing._sourceAmount === 0 && rawAcct.startsWith('$'))) {
        r365Map.set(label, { ...annotated, _sourceAmount: entry.amount });
      }
    } else {
      r365Map.set(label, { ...annotated, _sourceAmount: entry.amount });
    }
  }

  // Annotate Toast entries
  const annotatedToast = [];
  for (const entry of toastEntries) {
    // Toast uses the 'date' field as the row label/category name
    const rawLabel = String(entry.date || '').trim();
    const cleanLabel = _cleanToastLabel(rawLabel);

    // Skip entries explicitly mapped to null (non-financial rows)
    if (TOAST_TO_R365_MAP[cleanLabel] === null) continue;

    // Collect all candidate dollar amounts from the entry
    const candidates = _getToastCandidateAmounts(entry);

    // Skip count-only rows that carry no dollar amounts
    if (candidates.length === 0 || candidates.every(c => c === 0)) continue;

    annotatedToast.push({ ...entry, _label: cleanLabel, _candidates: candidates });
  }

  return { r365Annotated: Array.from(r365Map.values()), toastAnnotated: annotatedToast };
}

// Score how well a Toast entry matches an R365 entry (0–100).
// Account/label match contributes up to 60 points; amount match up to 40 points.
function _similarityScore(toast, r365) {
  let score = 0;

  // Account/label matching (up to 60 points)
  const mapping = TOAST_TO_R365_MAP[toast._label];
  if (mapping) {
    const r365Label = r365._label;
    if (mapping.some(kw => r365Label.includes(String(kw).toLowerCase()))) {
      score += 60;
    } else if (mapping.some(kw => r365Label.includes(String(kw).toLowerCase().split(' ')[0]))) {
      score += 40;
    }
  } else {
    if (toast._label && r365._label && toast._label === r365._label) score += 60;
    else if (toast._label && r365._label && r365._label.includes(toast._label)) score += 30;
  }

  // Amount matching (up to 40 points) — check all candidate amounts, use best
  const toastCandidates = toast._candidates || _getToastCandidateAmounts(toast);
  let bestAmtScore = 0;
  for (const cand of toastCandidates) {
    const result = _amountsMatch(cand, r365._amount);
    if (result.match) { bestAmtScore = 40; break; }
    if (result.diffPercent < 10) bestAmtScore = Math.max(bestAmtScore, 30);
    else if (result.diffPercent < 25) bestAmtScore = Math.max(bestAmtScore, 20);
    else if (result.diffPercent < 50) bestAmtScore = Math.max(bestAmtScore, 10);
  }
  score += bestAmtScore;

  return score;
}

// ─── Comparison Engine ────────────────────────────────────────────────────────

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

    const { r365Entries, toastEntries } = data;

    this.differences = [];
    this.matchedEntries = [];

    // Annotate and normalize entries for similarity-based matching
    const { r365Annotated, toastAnnotated } = _annotateEntries(r365Entries, toastEntries);

    // Greedy bipartite matching: assign each Toast entry to its best R365 entry
    const usedR365 = new Set();

    for (const toast of toastAnnotated) {
      let bestMatch = null;
      let bestScore = -1;

      for (const r365 of r365Annotated) {
        const score = _similarityScore(toast, r365);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = r365;
        }
      }

      // Require a minimum score and an unused R365 entry
      if (bestMatch && bestScore >= 40 && !usedR365.has(bestMatch._label)) {
        usedR365.add(bestMatch._label);

        // Find the candidate amount that is closest to the matched R365 amount
        const candidates = toast._candidates;
        let bestCandidate = candidates.length > 0 ? candidates[0] : 0;
        let bestDiff = Infinity;
        for (const cand of candidates) {
          const d = Math.abs(cand - bestMatch._amount);
          if (d < bestDiff) { bestDiff = d; bestCandidate = cand; }
        }

        const diff = Math.abs(bestCandidate - bestMatch._amount);
        if (diff > 0.01) {
          this.differences.push({
            type: 'AMOUNT_DIFFERENCE',
            toastEntry: toast,
            r365Entry: bestMatch,
            toastAmount: bestCandidate,
            r365Amount: bestMatch._amount,
            difference: diff,
            account: bestMatch._label,
            date: toast.date || toast._label,
            score: bestScore
          });
        } else {
          this.matchedEntries.push({
            toastEntry: toast,
            r365Entry: bestMatch,
            toastAmount: bestCandidate,
            r365Amount: bestMatch._amount,
            account: bestMatch._label,
            date: toast.date || toast._label,
            score: bestScore
          });
        }
      } else {
        // No satisfactory R365 match found for this Toast entry
        const toastAmount = toast._candidates.length > 0 ? toast._candidates[0] : 0;
        this.differences.push({
          type: 'TOAST_ONLY',
          toastEntry: toast,
          toastAmount,
          difference: toastAmount,
          account: toast._label,
          date: toast.date || toast._label,
          score: bestScore
        });
      }
    }

    // R365 entries that were never matched to a Toast entry
    for (const r365 of r365Annotated) {
      if (!usedR365.has(r365._label)) {
        this.differences.push({
          type: 'R365_ONLY',
          r365Entry: r365,
          r365Amount: r365._amount,
          difference: r365._amount,
          account: r365._label,
          date: r365.date,
          score: 0
        });
      }
    }

    // Save results
    await this.saveResults();

    return {
      differences: this.differences,
      matched: this.matchedEntries,
      summary: this.getSummary()
    };
  }

  // Get summary statistics
  getSummary() {
    const totalDifference = this.differences.reduce((sum, diff) => sum + (diff.difference || 0), 0);

    return {
      totalDifferences: this.differences.length,
      totalMatched: this.matchedEntries.length,
      totalVariance: totalDifference,
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
