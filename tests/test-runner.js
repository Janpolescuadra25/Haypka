/**
 * Haypka Test Runner
 * Minimal TAP-style framework that runs all registered suites
 * and renders results into the existing HTML shell.
 */

window.__testSuites = window.__testSuites || [];

/**
 * Register a test suite.
 * @param {string} name  - Suite label
 * @param {Function} fn  - Async function receiving `assert` helpers
 */
window.suite = function(name, fn) {
  window.__testSuites.push({ name, fn });
};

// ── Assertion helpers ──────────────────────────────────────────
const assert = {
  /** Fails if value is falsy */
  ok(value, msg = 'Expected truthy value') {
    if (!value) throw new Error(msg);
  },
  /** Strict deep equality via JSON */
  equal(actual, expected, msg) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) {
      throw new Error(msg || `Expected ${e} but got ${a}`);
    }
  },
  /** Strict inequality */
  notEqual(actual, expected, msg) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a === e) {
      throw new Error(msg || `Expected values to differ but both were ${a}`);
    }
  },
  /** Expects fn to throw */
  async throws(fn, msg = 'Expected function to throw') {
    try {
      await fn();
      throw new Error(msg);
    } catch (e) {
      if (e.message === msg) throw e; // re-throw our own error
    }
  },
  /** Numeric comparison */
  closeTo(actual, expected, delta = 0.001, msg) {
    if (Math.abs(actual - expected) > delta) {
      throw new Error(msg || `Expected ${actual} to be close to ${expected} (±${delta})`);
    }
  },
  /** Check array length */
  length(arr, expected, msg) {
    if (!Array.isArray(arr)) throw new Error(`Expected array but got ${typeof arr}`);
    if (arr.length !== expected) {
      throw new Error(msg || `Expected length ${expected} but got ${arr.length}`);
    }
  },
};

// ── Rendering helpers ──────────────────────────────────────────
function renderSuite(suiteResult) {
  const container = document.getElementById('suites');
  const allPass = suiteResult.tests.every(t => t.pass);

  const el = document.createElement('div');
  el.className = 'suite';
  el.innerHTML = `
    <div class="suite-header" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? '' : 'none'">
      <span class="suite-name">${suiteResult.name}</span>
      <span class="suite-badge ${allPass ? 'badge-pass' : 'badge-fail'}">
        ${suiteResult.tests.filter(t => t.pass).length} / ${suiteResult.tests.length}
      </span>
    </div>
    <div class="tests">
      ${suiteResult.tests.map(t => `
        <div class="test ${t.pass ? 'pass' : 'fail'}">
          <span class="icon">${t.pass ? '✔' : '✖'}</span>
          <div class="test-inner">
            <div class="name">${t.name}</div>
            ${!t.pass ? `<div class="err">${escapeHtml(t.error)}</div>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;
  container.appendChild(el);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function updateSummary(pass, fail, total) {
  document.getElementById('statTotal').textContent = total;
  document.getElementById('statPass').textContent = pass;
  document.getElementById('statFail').textContent = fail;

  const fill = document.getElementById('progressFill');
  fill.style.width = total > 0 ? `${(pass / total) * 100}%` : '0%';
  if (fail > 0) fill.classList.add('has-fail');
}

// ── Main runner ────────────────────────────────────────────────
async function runAllSuites() {
  const start = Date.now();
  let totalPass = 0;
  let totalFail = 0;

  for (const suite of window.__testSuites) {
    const suiteResult = { name: suite.name, tests: [] };
    const tests = [];

    // Each suite fn receives a `test` function
    const testFn = async (name, testBody) => {
      let pass = true;
      let error = '';
      try {
        await testBody(assert);
      } catch (e) {
        pass = false;
        error = e.message || String(e);
      }
      tests.push({ name, pass, error });
    };

    try {
      await suite.fn(testFn);
    } catch (e) {
      // Suite-level crash
      tests.push({ name: `[Suite setup error] ${e.message}`, pass: false, error: e.stack || e.message });
    }

    suiteResult.tests = tests;
    totalPass += tests.filter(t => t.pass).length;
    totalFail += tests.filter(t => !t.pass).length;

    renderSuite(suiteResult);
    updateSummary(totalPass, totalFail, totalPass + totalFail);

    // Yield to browser between suites
    await new Promise(r => setTimeout(r, 0));
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  document.getElementById('runTime').textContent = `Completed in ${elapsed}s`;

  // Reset chrome.storage between runs if needed
  chrome.storage.local._data = {};
}

// ── Boot ───────────────────────────────────────────────────────
window.addEventListener('load', () => {
  // Small delay to let all <script> tags load
  setTimeout(runAllSuites, 100);
});
