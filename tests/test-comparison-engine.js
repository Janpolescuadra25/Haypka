/**
 * Test Suite: ComparisonEngine
 * Tests the core comparison logic without requiring a browser extension context.
 * ComparisonEngine is patched here to use in-memory data instead of chrome.storage.
 */

suite('ComparisonEngine – Core Logic', async (test) => {

  // ── Helper to build an in-memory ComparisonEngine with preset data ──
  function makeEngine(r365Entries, toastEntries, accountMappings = { r365: {}, toast: {} }) {
    const engine = new ComparisonEngine();
    // Override loadData so we don't touch chrome.storage
    engine.loadData = async () => ({ r365Entries, toastEntries, accountMappings });
    // Override saveResults to be a no-op
    engine.saveResults = async () => {};
    return engine;
  }

  function entry(date, account, amount, source = 'R365') {
    return { date, account, amount, debit: amount, credit: 0, source };
  }

  // ─────────────────────────────────────────────────────────────

  await test('exact match – same date and account and amount', async (assert) => {
    const r365 = [entry('2025-01-01', 'Cash', 1000)];
    const toast = [entry('2025-01-01', 'Cash', 1000, 'Toast')];
    const engine = makeEngine(r365, toast);
    const results = await engine.compare();
    assert.length(results.differences, 0, 'No differences expected');
    assert.length(results.matched, 1, 'One matched entry expected');
  });

  await test('AMOUNT_DIFFERENCE – same key, amounts differ beyond threshold', async (assert) => {
    const r365 = [entry('2025-01-01', 'Sales', 500)];
    const toast = [entry('2025-01-01', 'Sales', 499, 'Toast')];
    const engine = makeEngine(r365, toast);
    const results = await engine.compare();
    assert.length(results.differences, 1);
    assert.equal(results.differences[0].type, 'AMOUNT_DIFFERENCE');
    assert.closeTo(results.differences[0].difference, 1);
  });

  await test('within threshold (< 0.01) – treated as matched', async (assert) => {
    const r365 = [entry('2025-01-01', 'Sales', 100.005)];
    const toast = [entry('2025-01-01', 'Sales', 100.000, 'Toast')];
    const engine = makeEngine(r365, toast);
    const results = await engine.compare();
    // diff = 0.005 < 0.01 → should match
    assert.length(results.differences, 0, 'Tiny rounding diff should be treated as matched');
    assert.length(results.matched, 1);
  });

  await test('R365_ONLY – entry only in R365', async (assert) => {
    const r365 = [entry('2025-01-02', 'Rent', 2000)];
    const toast = [];
    const engine = makeEngine(r365, toast);
    const results = await engine.compare();
    assert.length(results.differences, 1);
    assert.equal(results.differences[0].type, 'R365_ONLY');
    assert.equal(results.differences[0].account, 'Rent');
  });

  await test('TOAST_ONLY – entry only in Toast', async (assert) => {
    const r365 = [];
    const toast = [entry('2025-01-03', 'Tips', 150, 'Toast')];
    const engine = makeEngine(r365, toast);
    const results = await engine.compare();
    assert.length(results.differences, 1);
    assert.equal(results.differences[0].type, 'TOAST_ONLY');
  });

  await test('multiple entries – mixed outcomes', async (assert) => {
    const r365 = [
      entry('2025-01-01', 'Cash', 1000),
      entry('2025-01-01', 'Sales', 500),
      entry('2025-01-02', 'Rent', 2000),
    ];
    const toast = [
      entry('2025-01-01', 'Cash', 1000, 'Toast'),   // match
      entry('2025-01-01', 'Sales', 450, 'Toast'),   // amount diff
      // Rent not in Toast → R365_ONLY
    ];
    const engine = makeEngine(r365, toast);
    const results = await engine.compare();
    assert.length(results.matched, 1);
    assert.length(results.differences, 2);
  });

  await test('getSummary – correct totals', async (assert) => {
    const r365 = [
      entry('2025-01-01', 'Cash', 1000),
      entry('2025-01-01', 'Payroll', 300),
    ];
    const toast = [
      entry('2025-01-01', 'Cash', 950, 'Toast'),  // +50 diff
    ];
    const engine = makeEngine(r365, toast);
    const results = await engine.compare();
    const summary = results.summary;
    assert.equal(summary.totalDifferences, 2);
    assert.equal(summary.totalMatched, 0);
    assert.equal(summary.r365Only, 1);
    assert.equal(summary.toastOnly, 0);
    assert.equal(summary.amountDiffs, 1);
    assert.closeTo(summary.totalVariance, 350); // 50 (amount diff) + 300 (r365 only)
  });

  await test('account mapping – remaps account names before compare', async (assert) => {
    const r365 = [entry('2025-01-01', 'Bank Account', 500)];
    const toast = [entry('2025-01-01', 'Cash Drawer', 500, 'Toast')];
    const mappings = {
      r365: { 'Bank Account': 'Cash' },
      toast: { 'Cash Drawer': 'Cash' },
    };
    const engine = makeEngine(r365, toast, mappings);
    const results = await engine.compare();
    // After mapping both become 'Cash' → should match
    assert.length(results.differences, 0, 'Mapped accounts should match');
    assert.length(results.matched, 1);
  });

  await test('groupEntries – aggregates multiple rows for same date+account', async (assert) => {
    const engine = new ComparisonEngine();
    const entries = [
      { date: '2025-01-01', account: 'Sales', amount: 100, debit: 100, credit: 0 },
      { date: '2025-01-01', account: 'Sales', amount: 200, debit: 200, credit: 0 },
      { date: '2025-01-01', account: 'Cash',  amount: 50,  debit: 50,  credit: 0 },
    ];
    const grouped = engine.groupEntries(entries);
    assert.equal(grouped.size, 2, 'Should aggregate to 2 unique date+account keys');
    assert.closeTo(grouped.get('2025-01-01-Sales').amount, 300);
    assert.closeTo(grouped.get('2025-01-01-Cash').amount, 50);
  });

  await test('applyMappings – unmapped accounts keep original name', async (assert) => {
    const engine = new ComparisonEngine();
    const entries = [
      { date: '2025-01-01', account: 'Utilities', amount: 100 },
      { date: '2025-01-01', account: 'Sales',     amount: 200 },
    ];
    const mappings = { 'Sales': 'Revenue' };
    const mapped = engine.applyMappings(entries, mappings);
    assert.equal(mapped[0].account, 'Utilities', 'Unmapped should keep original');
    assert.equal(mapped[1].account, 'Revenue',   'Mapped should change');
  });

  await test('empty datasets – throws descriptive error', async (assert) => {
    const engine = makeEngine(null, null);
    let threw = false;
    try {
      await engine.compare();
    } catch (e) {
      threw = true;
      assert.ok(e.message.includes('Missing data'), `Error should mention missing data, got: "${e.message}"`);
    }
    assert.ok(threw, 'Should have thrown for null data');
  });

  await test('no differences – empty differences array', async (assert) => {
    const r365 = [
      entry('2025-01-01', 'Cash', 1500),
      entry('2025-01-01', 'Sales', 900),
    ];
    const toast = [
      entry('2025-01-01', 'Cash', 1500, 'Toast'),
      entry('2025-01-01', 'Sales', 900, 'Toast'),
    ];
    const engine = makeEngine(r365, toast);
    const results = await engine.compare();
    assert.length(results.differences, 0);
    assert.length(results.matched, 2);
    assert.equal(results.summary.totalVariance, 0);
  });
});
