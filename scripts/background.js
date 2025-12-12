// Background Service Worker - Handles communication and processing

console.log('R365-Toast Extension Background Service Worker loaded');

// Listen for scraper ready messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scraperReady') {
    console.log(`${request.source} scraper ready on ${request.url}`);
  }
});

// Handle icon click
chrome.action.onClicked.addListener((tab) => {
  chrome.action.openPopup();
});

// Periodic comparison (optional - can be triggered manually)
async function performComparison() {
  const { r365Entries, toastEntries, accountMappings } = await chrome.storage.local.get([
    'r365Entries',
    'toastEntries',
    'accountMappings'
  ]);
  
  if (!r365Entries || !toastEntries) {
    console.log('Missing data for comparison');
    return;
  }
  
  // This will be handled by comparison-engine.js
  console.log(`Ready to compare ${r365Entries.length} R365 entries with ${toastEntries.length} Toast entries`);
}

// Install/Update handler
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Extension installed');
    // Initialize default settings
    chrome.storage.local.set({
      accountMappings: {
        r365: {},
        toast: {}
      },
      customMessages: {},
      settings: {
        minDifferenceAmount: 0.01,
        autoExtract: false
      }
    });
  }
});
