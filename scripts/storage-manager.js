// Storage Manager - Utility functions for managing Chrome storage

class StorageManager {
  // Get all R365 entries
  static async getR365Entries() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['r365Entries'], (result) => {
        resolve(result.r365Entries || []);
      });
    });
  }

  // Get all Toast entries
  static async getToastEntries() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['toastEntries'], (result) => {
        resolve(result.toastEntries || []);
      });
    });
  }

  // Get account mappings
  static async getAccountMappings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['accountMappings'], (result) => {
        resolve(result.accountMappings || { r365: {}, toast: {} });
      });
    });
  }

  // Save account mappings
  static async saveAccountMappings(mappings) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ accountMappings: mappings }, resolve);
    });
  }

  // Get custom messages
  static async getCustomMessages() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['customMessages'], (result) => {
        resolve(result.customMessages || {});
      });
    });
  }

  // Save custom messages
  static async saveCustomMessages(messages) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ customMessages: messages }, resolve);
    });
  }

  // Get settings
  static async getSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['settings'], (result) => {
        resolve(result.settings || {
          minDifferenceAmount: 0.01,
          autoExtract: false
        });
      });
    });
  }

  // Save settings
  static async saveSettings(settings) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ settings }, resolve);
    });
  }

  // Get comparison results
  static async getComparisonResults() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['comparisonResults'], (result) => {
        resolve(result.comparisonResults || null);
      });
    });
  }

  // Clear R365 data
  static async clearR365Data() {
    return new Promise((resolve) => {
      chrome.storage.local.set({ r365Entries: [] }, resolve);
    });
  }

  // Clear Toast data
  static async clearToastData() {
    return new Promise((resolve) => {
      chrome.storage.local.set({ toastEntries: [] }, resolve);
    });
  }

  // Clear all data
  static async clearAllData() {
    return new Promise((resolve) => {
      chrome.storage.local.clear(resolve);
    });
  }

  // Export all data as JSON
  static async exportData() {
    return new Promise((resolve) => {
      chrome.storage.local.get(null, (result) => {
        const data = JSON.stringify(result, null, 2);
        resolve(data);
      });
    });
  }

  // Import data from JSON
  static async importData(jsonData) {
    return new Promise((resolve, reject) => {
      try {
        const data = JSON.parse(jsonData);
        chrome.storage.local.set(data, resolve);
      } catch (error) {
        reject(error);
      }
    });
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  window.StorageManager = StorageManager;
}