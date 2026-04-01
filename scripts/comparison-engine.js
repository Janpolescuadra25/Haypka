// Comparison Engine - Fuzzy matching of R365 journal entries against Toast POS data

const MIN_CANDIDATE_SCORE = 50;
const MIN_ACCEPT_SCORE = 60;

// Toast category label → R365 GL account (prefix-matched by _cleanToastLabel)
// null entries are non-financial rows that should be skipped
const TOAST_TO_R365_MAP = {
  'Beer': '5208 - Beer Sales',
  'Food': '5101 - Food Sales',
  'Liquor': '5201 - Liquor Sales',
  'NA Beverage': '5301 - NA Beverage Sales',
  'Wine': '5205 - Wine Sales',
  'Total guests': null,
  'Turn time': null
};

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
    const userMappings = (accountMappings && accountMappings.toast) || {};

    // Deduplicate R365 entries, keeping Format B (amount > 0)
    const cleanR365 = this._annotateEntries(r365Entries);

    this.differences = [];
    this.matchedEntries = [];

    // Track which R365 entries have been matched
    const matchedR365Indices = new Set();

    for (const toastEntry of toastEntries) {
      const toastLabel = this._cleanToastLabel(toastEntry.account || toastEntry.category || '');
      const toastAmount = toastEntry.amount || 0;

      // Skip non-financial rows that have no user override
      if (TOAST_TO_R365_MAP[toastLabel] === null && !userMappings[toastLabel]) {
        continue;
      }

      // Find best R365 match
      let bestScore = 0;
      let bestIdx = -1;

      for (let i = 0; i < cleanR365.length; i++) {
        const { score } = this._similarityScore(toastEntry, cleanR365[i], userMappings);
        if (score > bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }

      if (bestScore >= MIN_ACCEPT_SCORE && bestIdx !== -1) {
        const r365Entry = cleanR365[bestIdx];
        const r365Amount = r365Entry.amount || 0;
        const diff = Math.abs(toastAmount - r365Amount);
        matchedR365Indices.add(bestIdx);

        if (this._amountsMatch(toastAmount, r365Amount)) {
          this.matchedEntries.push({
            toastLabel,
            r365Label: r365Entry.account,
            toastAmount,
            r365Amount,
            difference: 0,
            _type: 'MATCHED'
          });
        } else {
          this.differences.push({
            toastLabel,
            r365Label: r365Entry.account,
            toastAmount,
            r365Amount,
            difference: diff,
            _type: 'AMOUNT_DIFF'
          });
        }
      } else {
        // Toast entry with no acceptable R365 match
        this.differences.push({
          toastLabel,
          r365Label: null,
          toastAmount,
          r365Amount: 0,
          difference: toastAmount,
          _type: 'TOAST_ONLY'
        });
      }
    }

    // R365 entries not matched by any Toast entry
    for (let i = 0; i < cleanR365.length; i++) {
      if (!matchedR365Indices.has(i)) {
        const r365Entry = cleanR365[i];
        const r365Amount = r365Entry.amount || 0;
        this.differences.push({
          toastLabel: null,
          r365Label: r365Entry.account,
          toastAmount: 0,
          r365Amount,
          difference: r365Amount,
          _type: 'R365_ONLY'
        });
      }
    }

    await this.saveResults();

    return {
      differences: this.differences,
      matched: this.matchedEntries,
      summary: this.getSummary()
    };
  }

  // Strip tooltip text from a Toast label using prefix-matching against TOAST_TO_R365_MAP keys
  _cleanToastLabel(label) {
    if (!label) return '';
    const normalized = label.trim();
    for (const key of Object.keys(TOAST_TO_R365_MAP)) {
      if (normalized.startsWith(key)) {
        return key;
      }
    }
    return normalized;
  }

  // Extract all candidate amounts from a Toast entry (amount, credit, debit)
  _getToastCandidateAmounts(entry) {
    const amounts = [];
    if (typeof entry.amount === 'number' && entry.amount > 0) amounts.push(entry.amount);
    if (typeof entry.credit === 'number' && entry.credit > 0) amounts.push(entry.credit);
    if (typeof entry.debit === 'number' && entry.debit > 0) amounts.push(entry.debit);
    return amounts;
  }

  // Deduplicate R365 entries grouped by date+account, keeping Format B (amount > 0).
  // When a date+account pair has both positive and non-positive entries, only the
  // positive ones (Format B) are kept.  When ALL entries for a pair are non-positive
  // (Format A only), they are kept as-is so no data is silently lost.
  _annotateEntries(entries) {
    const grouped = new Map();
    for (const entry of entries) {
      const key = `${entry.date}-${entry.account}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(entry);
    }
    const result = [];
    for (const group of grouped.values()) {
      const positive = group.filter(e => (e.amount || 0) > 0);
      result.push(...(positive.length > 0 ? positive : group));
    }
    return result;
  }

  // Check if two amounts match within a percentage-based tolerance.
  // tolerancePct is a decimal fraction; the default 0.005 equals 0.5 %.
  _amountsMatch(a, b, tolerancePct = 0.005) {
    if (a === 0 && b === 0) return true;
    const max = Math.max(Math.abs(a), Math.abs(b));
    return max === 0 || Math.abs(a - b) / max <= tolerancePct;
  }

  // Score a Toast/R365 entry pair.  Checks user manual mappings FIRST,
  // then falls back to the hardcoded TOAST_TO_R365_MAP, label overlap, and amount.
  _similarityScore(toastEntry, r365Entry, userMappings = {}) {
    let score = 0;
    const toastLabel = this._cleanToastLabel(toastEntry.account || toastEntry.category || '');
    const r365Label = r365Entry.account || '';
    const r365LabelLower = r365Label.toLowerCase();

    // 1. User manual mappings take highest priority
    if (userMappings[toastLabel]) {
      const mapped = userMappings[toastLabel].toLowerCase();
      if (
        r365LabelLower === mapped ||
        r365LabelLower.includes(mapped) ||
        mapped.includes(r365LabelLower)
      ) {
        score += 100;
        return { score };
      }
    }

    // 2. Hardcoded TOAST_TO_R365_MAP
    const hardcodedR365 = TOAST_TO_R365_MAP[toastLabel];
    if (hardcodedR365 === null) return { score: 0 }; // non-financial row
    if (hardcodedR365) {
      const hardcodedLower = hardcodedR365.toLowerCase();
      if (
        r365LabelLower === hardcodedLower ||
        r365LabelLower.includes(hardcodedLower) ||
        hardcodedLower.includes(r365LabelLower)
      ) {
        score += 60;
      }
    }

    // 3. Label substring match (up to 20 pts)
    if (toastLabel && r365LabelLower.includes(toastLabel.toLowerCase())) {
      score += 20;
    }

    // 4. Amount match (up to 20 pts)
    const candidates = this._getToastCandidateAmounts(toastEntry);
    const r365Amount = r365Entry.amount || 0;
    if (candidates.some(a => this._amountsMatch(a, r365Amount))) {
      score += 20;
    }

    return { score };
  }

  // Get summary statistics
  getSummary() {
    const totalVariance = this.differences.reduce((sum, d) => sum + (d.difference || 0), 0);
    return {
      totalDifferences: this.differences.length,
      totalMatched: this.matchedEntries.length,
      totalVariance,
      r365Only: this.differences.filter(d => d._type === 'R365_ONLY').length,
      toastOnly: this.differences.filter(d => d._type === 'TOAST_ONLY').length,
      amountDiffs: this.differences.filter(d => d._type === 'AMOUNT_DIFF').length
    };
  }

  // Load data from storage
  async loadData() {
    return new Promise((resolve) => {
      chrome.storage.local.get(
        ['r365Entries', 'toastEntries', 'accountMappings'],
        (result) => resolve(result)
      );
    });
  }

  // Save comparison results to chrome.storage.local['comparisonResults']
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
