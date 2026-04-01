/**
 * Test Suite: StorageManager
 * Tests all static methods using the chrome.storage.local mock
 * defined in test-runner.html.
 */

suite('StorageManager – CRUD Operations', async (test) => {

  // Reset storage before each logical group
  function resetStorage() {
    chrome.storage.local._data = {};
  }

  // ── R365 Entries ───────────────────────────────────────────────

  await test('getR365Entries – returns empty array by default', async (assert) => {
    resetStorage();
    const entries = await StorageManager.getR365Entries();
    assert.equal(entries, []);
  });

  await test('getR365Entries – returns stored entries', async (assert) => {
    resetStorage();
    const sample = [{ date: '2025-01-01', account: 'Cash', amount: 500 }];
    chrome.storage.local._data.r365Entries = sample;
    const entries = await StorageManager.getR365Entries();
    assert.equal(entries, sample);
  });

  // ── Toast Entries ──────────────────────────────────────────────

  await test('getToastEntries – returns empty array by default', async (assert) => {
    resetStorage();
    const entries = await StorageManager.getToastEntries();
    assert.equal(entries, []);
  });

  await test('getToastEntries – returns stored entries', async (assert) => {
    resetStorage();
    const sample = [{ date: '2025-01-01', account: 'Sales', amount: 300 }];
    chrome.storage.local._data.toastEntries = sample;
    const entries = await StorageManager.getToastEntries();
    assert.equal(entries, sample);
  });

  // ── Account Mappings ───────────────────────────────────────────

  await test('getAccountMappings – returns default empty structure', async (assert) => {
    resetStorage();
    const mappings = await StorageManager.getAccountMappings();
    assert.equal(mappings, { r365: {}, toast: {} });
  });

  await test('saveAccountMappings / getAccountMappings – round trip', async (assert) => {
    resetStorage();
    const input = { r365: { 'Bank': 'Cash' }, toast: { 'Food': 'Revenue' } };
    await StorageManager.saveAccountMappings(input);
    const output = await StorageManager.getAccountMappings();
    assert.equal(output, input);
  });

  await test('saveAccountMappings – overwrites previous mappings', async (assert) => {
    resetStorage();
    await StorageManager.saveAccountMappings({ r365: { 'Old': 'Value' }, toast: {} });
    await StorageManager.saveAccountMappings({ r365: { 'New': 'Value' }, toast: {} });
    const result = await StorageManager.getAccountMappings();
    assert.equal(result.r365, { 'New': 'Value' });
    assert.ok(!result.r365['Old'], 'Old mapping should be gone');
  });

  // ── Custom Messages ────────────────────────────────────────────

  await test('getCustomMessages – returns empty object by default', async (assert) => {
    resetStorage();
    const msgs = await StorageManager.getCustomMessages();
    assert.equal(msgs, {});
  });

  await test('saveCustomMessages / getCustomMessages – round trip', async (assert) => {
    resetStorage();
    const input = { r365Only: 'Check R365 entries', toastOnly: 'Check Toast', amountDiff: 'Amounts differ' };
    await StorageManager.saveCustomMessages(input);
    const output = await StorageManager.getCustomMessages();
    assert.equal(output, input);
  });

  // ── Settings ───────────────────────────────────────────────────

  await test('getSettings – returns defaults when not set', async (assert) => {
    resetStorage();
    const settings = await StorageManager.getSettings();
    assert.equal(settings.minDifferenceAmount, 0.01);
    assert.equal(settings.autoExtract, false);
  });

  await test('saveSettings / getSettings – round trip', async (assert) => {
    resetStorage();
    const input = { minDifferenceAmount: 0.5, autoExtract: true, showNotifications: false };
    await StorageManager.saveSettings(input);
    const output = await StorageManager.getSettings();
    assert.equal(output, input);
  });

  // ── Comparison Results ─────────────────────────────────────────

  await test('getComparisonResults – returns null when not set', async (assert) => {
    resetStorage();
    const results = await StorageManager.getComparisonResults();
    assert.equal(results, null);
  });

  await test('getComparisonResults – returns stored results', async (assert) => {
    resetStorage();
    const sample = { summary: { totalDifferences: 3 }, differences: [] };
    chrome.storage.local._data.comparisonResults = sample;
    const results = await StorageManager.getComparisonResults();
    assert.equal(results.summary.totalDifferences, 3);
  });

  // ── Clear Operations ───────────────────────────────────────────

  await test('clearR365Data – replaces r365Entries with empty array', async (assert) => {
    resetStorage();
    chrome.storage.local._data.r365Entries = [{ amount: 1 }];
    await StorageManager.clearR365Data();
    const entries = await StorageManager.getR365Entries();
    assert.equal(entries, []);
  });

  await test('clearToastData – replaces toastEntries with empty array', async (assert) => {
    resetStorage();
    chrome.storage.local._data.toastEntries = [{ amount: 1 }];
    await StorageManager.clearToastData();
    const entries = await StorageManager.getToastEntries();
    assert.equal(entries, []);
  });

  await test('clearR365Data – does not affect Toast entries', async (assert) => {
    resetStorage();
    chrome.storage.local._data.r365Entries = [{ amount: 1 }];
    chrome.storage.local._data.toastEntries = [{ amount: 2 }];
    await StorageManager.clearR365Data();
    const toast = await StorageManager.getToastEntries();
    assert.length(toast, 1, 'Toast entries should be untouched');
  });

  await test('clearAllData – removes everything from storage', async (assert) => {
    resetStorage();
    chrome.storage.local._data = {
      r365Entries: [{ amount: 1 }],
      toastEntries: [{ amount: 2 }],
      settings: { minDifferenceAmount: 0.5 },
    };
    await StorageManager.clearAllData();
    const r365 = await StorageManager.getR365Entries();
    const toast = await StorageManager.getToastEntries();
    const settings = await StorageManager.getSettings();
    assert.equal(r365, []);
    assert.equal(toast, []);
    // Settings should return defaults after clear
    assert.equal(settings.minDifferenceAmount, 0.01);
  });

  // ── Export / Import ────────────────────────────────────────────

  await test('exportData – returns valid JSON string', async (assert) => {
    resetStorage();
    chrome.storage.local._data = {
      r365Entries: [{ date: '2025-01-01', account: 'Cash', amount: 100 }],
      settings: { minDifferenceAmount: 0.01 },
    };
    const json = await StorageManager.exportData();
    const parsed = JSON.parse(json);
    assert.ok(parsed.r365Entries, 'Exported JSON should contain r365Entries');
    assert.equal(parsed.r365Entries[0].amount, 100);
  });

  await test('importData – restores data from JSON string', async (assert) => {
    resetStorage();
    const original = {
      r365Entries: [{ date: '2025-02-01', account: 'Sales', amount: 999 }],
      accountMappings: { r365: { 'Old': 'New' }, toast: {} },
    };
    await StorageManager.importData(JSON.stringify(original));
    const r365 = await StorageManager.getR365Entries();
    assert.length(r365, 1);
    assert.equal(r365[0].amount, 999);
    const mappings = await StorageManager.getAccountMappings();
    assert.equal(mappings.r365['Old'], 'New');
  });

  await test('importData – throws on invalid JSON', async (assert) => {
    resetStorage();
    let threw = false;
    try {
      await StorageManager.importData('{ invalid json !!!');
    } catch (e) {
      threw = true;
    }
    assert.ok(threw, 'Should throw on malformed JSON');
  });
});
