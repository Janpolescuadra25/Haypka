/**
 * Dashboard Interface Logic
 * R365 Toast Reconciliation Extension
 */

document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
});

/**
 * Initialize dashboard components
 */
function initializeDashboard() {
    loadUserProfile();
    loadRecentReconciliations();
    loadStatistics();
    setupEventListeners();
    startAutoRefresh();
}

/**
 * Load user profile information
 */
async function loadUserProfile() {
    try {
        const profile = await chrome.storage.sync.get(['userProfile', 'settings']);
        
        if (profile.userProfile) {
            document.getElementById('userName').textContent = profile.userProfile.name || 'User';
            document.getElementById('userRole').textContent = profile.userProfile.role || 'Admin';
        }
        
        // Load settings
        if (profile.settings) {
            applySettings(profile.settings);
        }
    } catch (error) {
        console.error('Error loading user profile:', error);
        showNotification('Failed to load user profile', 'error');
    }
}

/**
 * Load recent reconciliations
 * Reads from comparisonResults (latest comparison) or falls back to reconciliations history.
 */
async function loadRecentReconciliations() {
    try {
        const data = await chrome.storage.local.get(['comparisonResults', 'reconciliations']);
        let reconciliations = [];

        // Prefer comparisonResults populated by the comparison engine
        if (data.comparisonResults) {
            const results = data.comparisonResults;
            const entries = [
                ...(results.differences || []),
                ...(results.matched || [])
            ];
            reconciliations = entries.map((e, i) => {
                let status;
                if (e._type === 'MATCHED') {
                    status = 'matched';
                } else if (e._type === 'AMOUNT_DIFF' || e._type === 'TOAST_ONLY' || e._type === 'R365_ONLY') {
                    status = 'discrepancy';
                } else {
                    status = 'pending';
                }
                return {
                    id: `compare-${i}`,
                    date: results.lastCompared || new Date().toISOString(),
                    locationName: e.toastLabel || e.r365Label || 'Unknown',
                    category: e.toastLabel || e.r365Label || 'General',
                    toastAmount: e.toastAmount || 0,
                    r365Amount: e.r365Amount || 0,
                    status
                };
            });
        }

        // Fall back to stored reconciliations history if no comparison results
        if (reconciliations.length === 0 && data.reconciliations) {
            reconciliations = data.reconciliations || [];
        }

        // Sort by date (most recent first)
        reconciliations.sort((a, b) => new Date(b.date) - new Date(a.date));

        displayReconciliations(reconciliations.slice(0, 10));

    } catch (error) {
        console.error('Error loading reconciliations:', error);
        showNotification('Failed to load reconciliations', 'error');
    }
}

/**
 * Display reconciliations in the table
 */
function displayReconciliations(reconciliations) {
    const tbody = document.getElementById('reconciliationTableBody');
    
    if (!reconciliations || reconciliations.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-muted">
                    No reconciliations found
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = reconciliations.map(rec => `
        <tr data-id="${rec.id}" class="reconciliation-row">
            <td>${formatDate(rec.date)}</td>
            <td>${rec.locationName || 'N/A'}</td>
            <td>${rec.category || 'General'}</td>
            <td>$${formatCurrency(rec.toastAmount)}</td>
            <td>$${formatCurrency(rec.r365Amount)}</td>
            <td>
                <span class="badge ${getStatusBadgeClass(rec.status)}">
                    ${rec.status || 'Pending'}
                </span>
            </td>
            <td>
                <button class="btn btn-sm btn-primary view-details" data-id="${rec.id}">
                    View
                </button>
                <button class="btn btn-sm btn-secondary export-item" data-id="${rec.id}">
                    Export
                </button>
            </td>
        </tr>
    `).join('');
    
    // Add event listeners to buttons
    attachRowEventListeners();
}

/**
 * Load and display statistics
 */
async function loadStatistics() {
    try {
        const data = await chrome.storage.local.get(['comparisonResults', 'reconciliations', 'statistics']);

        let stats;

        // Prefer summary from the latest comparison engine run
        if (data.comparisonResults && data.comparisonResults.summary) {
            const s = data.comparisonResults.summary;
            stats = {
                total: s.totalMatched + s.totalDifferences,
                matched: s.totalMatched,
                discrepancies: s.totalDifferences,
                totalVariance: s.totalVariance,
                byCategory: {},
                byLocation: {},
                byDate: {}
            };
        } else {
            const reconciliations = data.reconciliations || [];
            stats = calculateStatistics(reconciliations);
        }

        // Update UI
        document.getElementById('totalReconciliations').textContent = stats.total;
        document.getElementById('matchedCount').textContent = stats.matched;
        document.getElementById('discrepancyCount').textContent = stats.discrepancies;
        document.getElementById('totalVariance').textContent = `$${formatCurrency(Math.abs(stats.totalVariance))}`;

        // Update charts
        updateCharts(stats);

    } catch (error) {
        console.error('Error loading statistics:', error);
        showNotification('Failed to load statistics', 'error');
    }
}

/**
 * Calculate statistics from reconciliations
 */
function calculateStatistics(reconciliations) {
    const stats = {
        total: reconciliations.length,
        matched: 0,
        discrepancies: 0,
        totalVariance: 0,
        byCategory: {},
        byLocation: {},
        byDate: {}
    };
    
    reconciliations.forEach(rec => {
        const variance = rec.r365Amount - rec.toastAmount;
        stats.totalVariance += variance;
        
        if (Math.abs(variance) < 0.01) {
            stats.matched++;
        } else {
            stats.discrepancies++;
        }
        
        // Group by category
        if (!stats.byCategory[rec.category]) {
            stats.byCategory[rec.category] = { count: 0, variance: 0 };
        }
        stats.byCategory[rec.category].count++;
        stats.byCategory[rec.category].variance += variance;
        
        // Group by location
        if (!stats.byLocation[rec.locationName]) {
            stats.byLocation[rec.locationName] = { count: 0, variance: 0 };
        }
        stats.byLocation[rec.locationName].count++;
        stats.byLocation[rec.locationName].variance += variance;
        
        // Group by date
        const dateKey = formatDate(rec.date);
        if (!stats.byDate[dateKey]) {
            stats.byDate[dateKey] = { count: 0, variance: 0 };
        }
        stats.byDate[dateKey].count++;
        stats.byDate[dateKey].variance += variance;
    });
    
    return stats;
}

/**
 * Update charts with statistics
 */
function updateCharts(stats) {
    // Update status pie chart
    updateStatusChart(stats.matched, stats.discrepancies);
    
    // Update variance trend chart
    updateVarianceTrendChart(stats.byDate);
    
    // Update category breakdown chart
    updateCategoryChart(stats.byCategory);
}

/**
 * Update status pie chart
 */
function updateStatusChart(matched, discrepancies) {
    const canvas = document.getElementById('statusChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Simple pie chart implementation
    const total = matched + discrepancies;
    const matchedPercent = total > 0 ? (matched / total) * 100 : 0;
    
    document.getElementById('matchRate').textContent = `${matchedPercent.toFixed(1)}%`;
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // New reconciliation button
    const newRecBtn = document.getElementById('newReconciliationBtn');
    if (newRecBtn) {
        newRecBtn.addEventListener('click', () => {
            window.location.href = 'reconciliation.html';
        });
    }
    
    // Refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            refreshDashboard();
        });
    }
    
    // Export all button
    const exportAllBtn = document.getElementById('exportAllBtn');
    if (exportAllBtn) {
        exportAllBtn.addEventListener('click', () => {
            exportAllReconciliations();
        });
    }
    
    // Date filter
    const dateFilter = document.getElementById('dateFilter');
    if (dateFilter) {
        dateFilter.addEventListener('change', (e) => {
            filterByDate(e.target.value);
        });
    }
    
    // Search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchReconciliations(e.target.value);
        });
    }
}

/**
 * Attach event listeners to table rows
 */
function attachRowEventListeners() {
    // View details buttons
    document.querySelectorAll('.view-details').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-id');
            viewReconciliationDetails(id);
        });
    });
    
    // Export item buttons
    document.querySelectorAll('.export-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-id');
            exportReconciliation(id);
        });
    });
}

/**
 * View reconciliation details
 */
async function viewReconciliationDetails(id) {
    try {
        const data = await chrome.storage.local.get(['reconciliations']);
        const reconciliation = data.reconciliations?.find(r => r.id === id);
        
        if (reconciliation) {
            showDetailsModal(reconciliation);
        } else {
            showNotification('Reconciliation not found', 'error');
        }
    } catch (error) {
        console.error('Error viewing details:', error);
        showNotification('Failed to load details', 'error');
    }
}

/**
 * Show details modal
 */
function showDetailsModal(reconciliation) {
    const modal = document.getElementById('detailsModal');
    if (!modal) return;
    
    // Populate modal with reconciliation details
    document.getElementById('detailDate').textContent = formatDate(reconciliation.date);
    document.getElementById('detailLocation').textContent = reconciliation.locationName;
    document.getElementById('detailCategory').textContent = reconciliation.category;
    document.getElementById('detailToastAmount').textContent = `$${formatCurrency(reconciliation.toastAmount)}`;
    document.getElementById('detailR365Amount').textContent = `$${formatCurrency(reconciliation.r365Amount)}`;
    
    const variance = reconciliation.r365Amount - reconciliation.toastAmount;
    document.getElementById('detailVariance').textContent = `$${formatCurrency(variance)}`;
    document.getElementById('detailVariance').className = variance >= 0 ? 'text-success' : 'text-danger';
    
    // Show modal
    modal.style.display = 'block';
}

/**
 * Export single reconciliation
 */
async function exportReconciliation(id) {
    try {
        const data = await chrome.storage.local.get(['reconciliations']);
        const reconciliation = data.reconciliations?.find(r => r.id === id);
        
        if (reconciliation) {
            downloadAsJSON([reconciliation], `reconciliation_${id}.json`);
            showNotification('Reconciliation exported successfully', 'success');
        }
    } catch (error) {
        console.error('Error exporting reconciliation:', error);
        showNotification('Failed to export reconciliation', 'error');
    }
}

/**
 * Export all reconciliations
 */
async function exportAllReconciliations() {
    try {
        const data = await chrome.storage.local.get(['reconciliations']);
        const reconciliations = data.reconciliations || [];
        
        if (reconciliations.length > 0) {
            downloadAsJSON(reconciliations, `all_reconciliations_${Date.now()}.json`);
            showNotification(`Exported ${reconciliations.length} reconciliations`, 'success');
        } else {
            showNotification('No reconciliations to export', 'warning');
        }
    } catch (error) {
        console.error('Error exporting all reconciliations:', error);
        showNotification('Failed to export reconciliations', 'error');
    }
}

/**
 * Download data as JSON file
 */
function downloadAsJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Refresh dashboard data
 */
function refreshDashboard() {
    showNotification('Refreshing dashboard...', 'info');
    loadRecentReconciliations();
    loadStatistics();
}

/**
 * Filter reconciliations by date
 */
async function filterByDate(dateRange) {
    try {
        const data = await chrome.storage.local.get(['reconciliations']);
        let reconciliations = data.reconciliations || [];
        
        if (dateRange !== 'all') {
            const now = new Date();
            let startDate;
            
            switch (dateRange) {
                case 'today':
                    startDate = new Date(now.setHours(0, 0, 0, 0));
                    break;
                case 'week':
                    startDate = new Date(now.setDate(now.getDate() - 7));
                    break;
                case 'month':
                    startDate = new Date(now.setMonth(now.getMonth() - 1));
                    break;
            }
            
            reconciliations = reconciliations.filter(r => 
                new Date(r.date) >= startDate
            );
        }
        
        displayReconciliations(reconciliations.slice(0, 10));
    } catch (error) {
        console.error('Error filtering by date:', error);
    }
}

/**
 * Search reconciliations
 */
async function searchReconciliations(query) {
    if (!query) {
        loadRecentReconciliations();
        return;
    }
    
    try {
        const data = await chrome.storage.local.get(['reconciliations']);
        let reconciliations = data.reconciliations || [];
        
        query = query.toLowerCase();
        reconciliations = reconciliations.filter(r => 
            r.locationName?.toLowerCase().includes(query) ||
            r.category?.toLowerCase().includes(query) ||
            r.status?.toLowerCase().includes(query)
        );
        
        displayReconciliations(reconciliations.slice(0, 10));
    } catch (error) {
        console.error('Error searching reconciliations:', error);
    }
}

/**
 * Start auto-refresh timer
 */
function startAutoRefresh() {
    // Refresh every 5 minutes
    setInterval(() => {
        loadRecentReconciliations();
        loadStatistics();
    }, 5 * 60 * 1000);
}

/**
 * Apply user settings
 */
function applySettings(settings) {
    if (settings.theme) {
        document.body.className = settings.theme;
    }
    
    if (settings.autoRefresh === false) {
        // Disable auto-refresh if setting is false
        clearInterval(window.autoRefreshInterval);
    }
}

/**
 * Utility: Format date
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

/**
 * Utility: Format currency
 */
function formatCurrency(amount) {
    return parseFloat(amount || 0).toFixed(2);
}

/**
 * Utility: Get status badge class
 */
function getStatusBadgeClass(status) {
    const statusMap = {
        'matched': 'badge-success',
        'discrepancy': 'badge-warning',
        'pending': 'badge-secondary',
        'resolved': 'badge-info',
        'error': 'badge-danger'
    };
    
    return statusMap[status?.toLowerCase()] || 'badge-secondary';
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

/**
 * Utility: Update variance trend chart
 */
function updateVarianceTrendChart(byDate) {
    const canvas = document.getElementById('varianceTrendChart');
    if (!canvas) return;
    
    // Chart implementation would go here
    console.log('Variance trend data:', byDate);
}

/**
 * Utility: Update category chart
 */
function updateCategoryChart(byCategory) {
    const canvas = document.getElementById('categoryChart');
    if (!canvas) return;
    
    // Chart implementation would go here
    console.log('Category data:', byCategory);
}
