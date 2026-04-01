// Background Service Worker - Handles communication and storage initialization
// Manifest V3 - chrome.action.onClicked is NOT fired when a popup is configured,
// so we only register the message listener and the install handler here.

console.log('R365-Toast Extension Background Service Worker loaded');

// Listen for scraper-ready pings from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scraperReady') {
    console.log(`[Background] ${request.source} scraper ready on ${request.url}`);
  }
});

// Install / update handler – sets sensible defaults
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[Background] Extension installed – initializing defaults');
    chrome.storage.local.set({
      accountMappings: { r365: {}, toast: {} },
      customMessages: {
        r365Only: '',
        toastOnly: '',
        amountDiff: '',
      },
      settings: {
        minDifferenceAmount: 0.01,
        autoExtract: false,
        showNotifications: true,
      },
    });
  }

  if (details.reason === 'update') {
    console.log(`[Background] Extension updated to v${chrome.runtime.getManifest().version}`);
  }
});
