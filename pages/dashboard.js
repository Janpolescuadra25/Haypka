/**
 * Dashboard Interface Logic
 * R365 Toast Reconciliation Extension
 */

// In-memory copy of the current comparison results (for search/filter)
let _currentResults = null;

document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
});

/**
 * Initialize dashboard components
 */
function initializeDashboard() {
    loadComparisonResults();
    setupEventListeners();
    startAutoRefresh();
}

/**
 * Load comparison results from storage and render dashboard
 */
async function loadComparisonResults() {
    try {
        const data = await chrome.storage.local.get(['comparisonResults']);
        const results = data.comparisonResults || null;

        if (!results) {
            document.getElementById('noData').style.display = 'block';
            updateSummaryCards({ totalDifferences: 0, totalMatched: 0, totalVariance: 0, r365Only: 0, toastOnly: 0, amountDiffs: 0 });
            return;
        }

        document.getElementById('noData').style.display = 'none';
        _currentResults = results;

        updateSummaryCards(results.summary);
        renderDifferences(results.differences, results.matched, 'all', '');

    } catch (error) {
        console.error('Error loading comparison results:', error);
        showNotification('Failed to load comparison results', 'error');
    }
}

/**
 * Update the six summary stat cards
 */
function updateSummaryCards(summary) {
    document.getElementById('totalDiff').textContent = summary.totalDifferences;
    document.getElementById('totalMatched').textContent = summary.totalMatched;
    document.getElementById('totalVariance').textContent = `$${formatCurrency(summary.totalVariance)}`;
    document.getElementById('r365Only').textContent = summary.r365Only;
    document.getElementById('toastOnly').textContent = summary.toastOnly;
    document.getElementById('amountDiffs').textContent = summary.amountDiffs;
}

/**
 * Render the differences list, applying type filter and search query
 */
function renderDifferences(differences, matched, typeFilter, searchQuery) {
    const container = document.getElementById('differencesList');
    if (!container) return;

    // Combine differences and matched entries into one list for filtering
    let entries = [
        ...differences,
        ...matched.map(m => ({ ...m, type: 'MATCHED' })),
    ];

    // Apply type filter
    if (typeFilter && typeFilter !== 'all') {
        entries = entries.filter(e => e.type === typeFilter);
    }

    // Apply search
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        entries = entries.filter(e => {
            const account = (e.account || '').toLowerCase();
            const date = (e.date || '').toLowerCase();
            const r365Account = (e.r365Entry?.account || '').toLowerCase();
            const toastAccount = (e.toastEntry?.account || '').toLowerCase();
            return account.includes(q) || date.includes(q) || r365Account.includes(q) || toastAccount.includes(q);
        });
    }

    if (entries.length === 0) {
        container.innerHTML = '<p class="no-data">No entries match your filter.</p>';
        return;
    }

    container.innerHTML = entries.map((entry, idx) => buildEntryCard(entry, idx)).join('');
}

/**
 * Build an HTML card for a single difference/match entry
 */
function buildEntryCard(entry, idx) {
    const typeLabels = {
        MATCHED: 'Matched',
        AMOUNT_DIFFERENCE: 'Amount Difference',
        R365_ONLY: 'R365 Only',
        TOAST_ONLY: 'Toast Only',
    };
    const typeClasses = {
        MATCHED: 'badge-success',
        AMOUNT_DIFFERENCE: 'badge-warning',
        R365_ONLY: 'badge-info',
        TOAST_ONLY: 'badge-secondary',
    };

    const label = typeLabels[entry.type] || entry.type;
    const badgeClass = typeClasses[entry.type] || 'badge-secondary';

    const r365Account = entry.r365Entry ? entry.r365Entry.account : '—';
    const toastAccount = entry.toastEntry ? entry.toastEntry.account : '—';

    let r365Amount = 0;
    if (entry.r365Amount !== undefined) {
        r365Amount = entry.r365Amount;
    } else if (entry.r365Entry) {
        r365Amount = parseFloat(entry.r365Entry.debit || 0) || parseFloat(entry.r365Entry.credit || 0) || parseFloat(entry.r365Entry.amount || 0);
    }

    let toastAmount = 0;
    if (entry.toastAmount !== undefined) {
        toastAmount = entry.toastAmount;
    } else if (entry.toastEntry) {
        toastAmount = parseFloat(entry.toastEntry.credit || 0) || parseFloat(entry.toastEntry.debit || 0) || parseFloat(entry.toastEntry.amount || 0);
    }

    const diff = Math.abs(entry.difference || 0);
    const diffText = diff > 0 ? `-$${formatCurrency(diff)}` : '$0.00';
    const diffClass = diff > 0 ? 'text-danger' : 'text-success';

    return `
        <div class="difference-item" data-idx="${idx}">
            <div class="difference-header">
                <span class="badge ${badgeClass}">${escapeHtml(label)}</span>
                <span class="account">${escapeHtml(entry.account || r365Account || toastAccount)}</span>
                <span class="date">${escapeHtml(entry.date || '')}</span>
            </div>
            <div class="difference-details">
                <div>
                    <span class="label">R365:</span>
                    <span>${escapeHtml(r365Account)}</span>
                    <span class="amount">$${formatCurrency(r365Amount)}</span>
                </div>
                <div>
                    <span class="label">Toast:</span>
                    <span>${escapeHtml(toastAccount)}</span>
                    <span class="amount">$${formatCurrency(toastAmount)}</span>
                </div>
                <div>
                    <span class="label">Variance:</span>
                    <span class="${diffClass} amount">${diffText}</span>
                </div>
            </div>
        </div>
    `;
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            showNotification('Refreshing...', 'info');
            loadComparisonResults();
        });
    }

    // Type filter
    const typeFilter = document.getElementById('typeFilter');
    if (typeFilter) {
        typeFilter.addEventListener('change', applyFilters);
    }

    // Search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', applyFilters);
    }

    // Clear data button
    const clearDataBtn = document.getElementById('clearDataBtn');
    if (clearDataBtn) {
        clearDataBtn.addEventListener('click', async () => {
            if (confirm('Clear all comparison data?')) {
                await chrome.storage.local.remove(['comparisonResults', 'r365Entries', 'toastEntries']);
                _currentResults = null;
                loadComparisonResults();
                showNotification('All data cleared', 'success');
            }
        });
    }
}

/**
 * Apply current filter and search to the displayed list
 */
function applyFilters() {
    if (!_currentResults) return;
    const typeFilter = document.getElementById('typeFilter');
    const searchInput = document.getElementById('searchInput');
    const filterVal = typeFilter ? typeFilter.value : 'all';
    const searchVal = searchInput ? searchInput.value : '';
    renderDifferences(_currentResults.differences, _currentResults.matched, filterVal, searchVal);
}

/**
 * Start auto-refresh timer (every 5 minutes)
 */
function startAutoRefresh() {
    setInterval(() => {
        loadComparisonResults();
    }, 5 * 60 * 1000);
}

/**
 * Utility: Format currency
 */
function formatCurrency(amount) {
    return parseFloat(amount || 0).toFixed(2);
}

/**
 * Utility: Escape HTML to prevent XSS
 */
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Show notification
 */
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} notification`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}
