// dev-tools.js — Test data seeder for Haypka extension

// ── Helpers ────────────────────────────────────────────────────
function log(msg) {
  const el = document.getElementById('logOutput');
  const ts = new Date().toLocaleTimeString();
  el.textContent += `\n[${ts}] ${msg}`;
  el.scrollTop = el.scrollHeight;
}

function makeEntry(date, account, amount, source, extra = {}) {
  return {
    date, account, amount,
    debit:       source === 'R365' ? amount : 0,
    credit:      source === 'Toast' ? amount : 0,
    description: extra.description || `${account} transaction`,
    reference:   extra.reference   || `REF-${Math.floor(Math.random() * 90000 + 10000)}`,
    source,
    extractedAt: new Date().toISOString(),
    ...extra,
  };
}

function buildSummary(differences, matched) {
  const totalVariance = differences.reduce((s, d) => s + d.difference, 0);
  return {
    totalDifferences: differences.length,
    totalMatched:     matched.length,
    totalVariance:    Math.round(totalVariance * 100) / 100,
    r365Only:    differences.filter(d => d.type === 'R365_ONLY').length,
    toastOnly:   differences.filter(d => d.type === 'TOAST_ONLY').length,
    amountDiffs: differences.filter(d => d.type === 'AMOUNT_DIFFERENCE').length,
  };
}

async function seedToStorage(scenarioName, r365Entries, toastEntries, differences, matched) {
  const summary = buildSummary(differences, matched);
  const comparisonResults = {
    differences,
    matched,
    summary,
    lastCompared: new Date().toISOString(),
  };

  await chrome.storage.local.set({ r365Entries, toastEntries, comparisonResults });

  log(`✔ ${scenarioName} seeded to storage.`);
  log(`  → R365 entries:    ${r365Entries.length}`);
  log(`  → Toast entries:   ${toastEntries.length}`);
  log(`  → Matched:         ${summary.totalMatched}`);
  log(`  → Differences:     ${summary.totalDifferences}`);
  log(`     • Amount diffs: ${summary.amountDiffs}`);
  log(`     • Toast only:   ${summary.toastOnly}`);
  log(`     • R365 only:    ${summary.r365Only}`);
  log(`  → Total variance:  $${Math.abs(summary.totalVariance).toFixed(2)}`);
  log(`\nOpen the dashboard to see the results →`);
}

// ── Scenario A — Mixed results ─────────────────────────────────
function buildScenarioA() {
  const today = new Date().toISOString().split('T')[0];
  const yday  = new Date(Date.now() - 864e5).toISOString().split('T')[0];

  const r365 = [
    makeEntry(today, 'Food Sales',      4250.00, 'R365'),
    makeEntry(today, 'Beverage Sales',   980.50, 'R365'),
    makeEntry(today, 'Catering',        1500.00, 'R365'),
    makeEntry(yday,  'Delivery Fees',    312.75, 'R365'), // R365 only
    makeEntry(today, 'Merchandise',      145.00, 'R365'),
  ];

  const toast = [
    makeEntry(today, 'Food Sales',      4250.00, 'Toast'),
    makeEntry(today, 'Beverage Sales',   945.00, 'Toast'), // amount diff: -35.50
    makeEntry(today, 'Catering',        1500.00, 'Toast'),
    makeEntry(today, 'Gift Cards',       200.00, 'Toast'), // Toast only
    makeEntry(today, 'Merchandise',      175.00, 'Toast'), // amount diff: +30
  ];

  const matched = [
    { date: today, account: 'Food Sales',  r365Entry: r365[0], toastEntry: toast[0] },
    { date: today, account: 'Catering',    r365Entry: r365[2], toastEntry: toast[2] },
  ];

  const differences = [
    {
      type: 'AMOUNT_DIFFERENCE',
      date: today, account: 'Beverage Sales',
      r365Entry: r365[1], toastEntry: toast[1],
      difference: Math.abs(980.50 - 945.00),
    },
    {
      type: 'AMOUNT_DIFFERENCE',
      date: today, account: 'Merchandise',
      r365Entry: r365[4], toastEntry: toast[4],
      difference: Math.abs(145.00 - 175.00),
    },
    {
      type: 'TOAST_ONLY',
      date: today, account: 'Gift Cards',
      toastEntry: toast[3],
      difference: 200.00,
    },
    {
      type: 'R365_ONLY',
      date: yday, account: 'Delivery Fees',
      r365Entry: r365[3],
      difference: 312.75,
    },
  ];

  return { r365, toast, differences, matched };
}

// ── Scenario B — All matched ────────────────────────────────────
function buildScenarioB() {
  const today = new Date().toISOString().split('T')[0];

  const accounts = [
    ['Food Sales',       8450.00],
    ['Beverage Sales',   2310.50],
    ['Catering',         3200.00],
    ['Merchandise',       480.25],
    ['Delivery Fees',     620.00],
    ['Gift Cards',        150.00],
  ];

  const r365  = accounts.map(([acct, amt]) => makeEntry(today, acct, amt, 'R365'));
  const toast = accounts.map(([acct, amt]) => makeEntry(today, acct, amt, 'Toast'));

  const matched = accounts.map(([acct], i) => ({
    date: today, account: acct,
    r365Entry: r365[i], toastEntry: toast[i],
  }));

  return { r365, toast, differences: [], matched };
}

// ── Scenario C — Large variance ─────────────────────────────────
function buildScenarioC() {
  const today = new Date().toISOString().split('T')[0];
  const d1    = new Date(Date.now() - 864e5).toISOString().split('T')[0];
  const d2    = new Date(Date.now() - 2 * 864e5).toISOString().split('T')[0];

  const r365 = [
    makeEntry(today, 'Food Sales',      12500.00, 'R365'),
    makeEntry(today, 'Beverage Sales',   3800.00, 'R365'),
    makeEntry(today, 'Service Charge',   1200.00, 'R365'),
    makeEntry(d1,    'Catering',         5000.00, 'R365'),
    makeEntry(d1,    'Bar Sales',        2200.00, 'R365'), // R365 only
    makeEntry(d2,    'Banquet',          8000.00, 'R365'), // R365 only
    makeEntry(today, 'Merchandise',       300.00, 'R365'),
  ];

  const toast = [
    makeEntry(today, 'Food Sales',      11800.00, 'Toast'), // diff -700
    makeEntry(today, 'Beverage Sales',   4100.00, 'Toast'), // diff +300
    makeEntry(today, 'Service Charge',    950.00, 'Toast'), // diff -250
    makeEntry(d1,    'Catering',         4750.00, 'Toast'), // diff -250
    makeEntry(today, 'Online Orders',     620.00, 'Toast'), // Toast only
    makeEntry(d1,    'Delivery Fees',     430.00, 'Toast'), // Toast only
    makeEntry(d2,    'Special Events',   1100.00, 'Toast'), // Toast only
    makeEntry(today, 'Merchandise',       300.00, 'Toast'),
  ];

  const matched = [
    { date: today, account: 'Merchandise', r365Entry: r365[6], toastEntry: toast[7] },
  ];

  const differences = [
    { type: 'AMOUNT_DIFFERENCE', date: today, account: 'Food Sales',      r365Entry: r365[0], toastEntry: toast[0], difference: 700.00  },
    { type: 'AMOUNT_DIFFERENCE', date: today, account: 'Beverage Sales',  r365Entry: r365[1], toastEntry: toast[1], difference: 300.00  },
    { type: 'AMOUNT_DIFFERENCE', date: today, account: 'Service Charge',  r365Entry: r365[2], toastEntry: toast[2], difference: 250.00  },
    { type: 'AMOUNT_DIFFERENCE', date: d1,    account: 'Catering',        r365Entry: r365[3], toastEntry: toast[3], difference: 250.00  },
    { type: 'R365_ONLY',         date: d1,    account: 'Bar Sales',       r365Entry: r365[4],                       difference: 2200.00 },
    { type: 'R365_ONLY',         date: d2,    account: 'Banquet',         r365Entry: r365[5],                       difference: 8000.00 },
    { type: 'TOAST_ONLY',        date: today, account: 'Online Orders',                        toastEntry: toast[4], difference: 620.00  },
    { type: 'TOAST_ONLY',        date: d1,    account: 'Delivery Fees',                        toastEntry: toast[5], difference: 430.00  },
    { type: 'TOAST_ONLY',        date: d2,    account: 'Special Events',                       toastEntry: toast[6], difference: 1100.00 },
  ];

  return { r365, toast, differences, matched };
}

// ── Event wiring ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('seedScenarioA').addEventListener('click', async () => {
    log('\n── Seeding Scenario A (Mixed Results) ──');
    const { r365, toast, differences, matched } = buildScenarioA();
    await seedToStorage('Scenario A', r365, toast, differences, matched);
  });

  document.getElementById('seedScenarioB').addEventListener('click', async () => {
    log('\n── Seeding Scenario B (All Matched) ──');
    const { r365, toast, differences, matched } = buildScenarioB();
    await seedToStorage('Scenario B', r365, toast, differences, matched);
  });

  document.getElementById('seedScenarioC').addEventListener('click', async () => {
    log('\n── Seeding Scenario C (Large Variance) ──');
    const { r365, toast, differences, matched } = buildScenarioC();
    await seedToStorage('Scenario C', r365, toast, differences, matched);
  });

  document.getElementById('viewStorageBtn').addEventListener('click', async () => {
    log('\n── Raw Storage Snapshot ──');
    const data = await chrome.storage.local.get(null);
    const keys = Object.keys(data);
    keys.forEach(k => {
      const val = data[k];
      const summary = Array.isArray(val)
        ? `[Array(${val.length})]`
        : typeof val === 'object'
          ? JSON.stringify(val, null, 2).slice(0, 300) + '…'
          : String(val);
      log(`  ${k}: ${summary}`);
    });
  });

  document.getElementById('clearStorageBtn').addEventListener('click', async () => {
    if (!confirm('Clear ALL extension storage? This removes all entries and comparison results.')) return;
    await chrome.storage.local.clear();
    log('\n── All storage cleared ──');
  });
});
