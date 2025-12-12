// Comparison Engine - Compares R365 and Toast entries to find differences

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

    // Apply account mappings
    const mappedR365 = this.applyMappings(r365Entries, accountMappings.r365 || {});
    const mappedToast = this.applyMappings(toastEntries, accountMappings.toast || {});

    // Find differences
    this.differences = [];
    this.matchedEntries = [];

    // Group by date and account
    const r365Map = this.groupEntries(mappedR365);
    const toastMap = this.groupEntries(mappedToast);

    // Compare entries
    const allKeys = new Set([...r365Map.keys(), ...toastMap.keys()]);

    for (const key of allKeys) {
      const r365Entry = r365Map.get(key);
      const toastEntry = toastMap.get(key);

      if (!r365Entry && toastEntry) {
        // Only in Toast
        this.differences.push({
          type: 'TOAST_ONLY',
          toastEntry,
          difference: toastEntry.amount,
          account: toastEntry.account,
          date: toastEntry.date
        });
      } else if (r365Entry && !toastEntry) {
        // Only in R365
        this.differences.push({
          type: 'R365_ONLY',
          r365Entry,
          difference: r365Entry.amount,
          account: r365Entry.account,
          date: r365Entry.date
        });
      } else if (r365Entry && toastEntry) {
        // In both - check amounts
        const diff = Math.abs(r365Entry.amount - toastEntry.amount);
        
        if (diff > 0.01) { // Threshold for differences
          this.differences.push({
            type: 'AMOUNT_DIFFERENCE',
            r365Entry,
            toastEntry,
            difference: diff,
            account: r365Entry.account,
            date: r365Entry.date
          });
        } else {
          this.matchedEntries.push({
            r365Entry,
            toastEntry,
            account: r365Entry.account,
            date: r365Entry.date
          });
        }
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

  // Apply account mappings
  applyMappings(entries, mappings) {
    return entries.map(entry => ({
      ...entry,
      account: mappings[entry.account] || entry.account
    }));
  }

  // Group entries by date and account
  groupEntries(entries) {
    const map = new Map();
    
    entries.forEach(entry => {
      const key = `${entry.date}-${entry.account}`;
      
      if (!map.has(key)) {
        map.set(key, entry);
      } else {
        // Aggregate if multiple entries for same date/account
        const existing = map.get(key);
        existing.amount += entry.amount;
        existing.debit += entry.debit || 0;
        existing.credit += entry.credit || 0;
      }
    });

    return map;
  }

  // Get summary statistics
  getSummary() {
    const totalDifference = this.differences.reduce((sum, diff) => sum + diff.difference, 0);
    
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
