# R365 & Toast POS Reconciliation Extension

A browser extension that helps you reconcile accounting entries between Restaurant 365 (R365) and Toast POS systems without using APIs.

## 🎯 Features

- **Web Scraping**: Extracts data directly from R365 and Toast websites (no API needed)
- **Journal Entry Format**: Converts both systems' data into standardized journal entries
- **Account Mapping**: Map R365 and Toast accounts to your custom chart of accounts
- **Smart Comparison**: Automatically detects differences between the two systems
- **Custom Alerts**: Configure messages for specific accounts when differences are found
- **Visual Dashboard**: Side-by-side comparison with highlighted differences

## 📦 Installation

### For Chrome/Edge/Brave

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right corner)
4. Click **Load unpacked**
5. Select the folder containing this extension
6. The extension icon should appear in your browser toolbar

### For Firefox

1. Download or clone this repository
2. Open Firefox and go to `about:debugging#/runtime/this-firefox`
3. Click **Load Temporary Add-on**
4. Select the `manifest.json` file from this extension folder
5. The extension will be loaded temporarily

## 🚀 How to Use

### Step 1: Initial Setup

1. Click the extension icon in your toolbar
2. Go to **Settings** (gear icon)
3. The extension will guide you through initial configuration

### Step 2: Extract Data from R365

1. Log into your R365 account at restaurant365.com
2. Navigate to the page with entries you want to extract (e.g., journal entries, transactions)
3. The extension will automatically detect R365 and show a notification
4. Click the extension icon and select **Extract R365 Data**
5. The data will be saved locally in your browser

### Step 3: Extract Data from Toast POS

1. Log into your Toast POS account at toasttab.com
2. Navigate to the sales/transaction page
3. The extension will automatically detect Toast
4. Click the extension icon and select **Extract Toast Data**
5. The data will be saved locally

### Step 4: Map Accounts

1. Open the extension and go to **Settings**
2. You'll see two mapping tables:
   - **R365 Account Mapping**: Map R365 accounts to your chart of accounts
   - **Toast Category Mapping**: Map Toast categories to your chart of accounts
3. For each account/category, select or type the corresponding account name
4. Click **Save Mappings**

### Step 5: Configure Alert Messages

1. In **Settings**, scroll to **Custom Messages**
2. For each account, you can set a custom message that appears when differences are found
3. Example: For "Cash" account, set message: "Verify all deposit entries and cash receipts"
4. Click **Save Messages**

### Step 6: Compare Entries

1. Click the extension icon and select **View Dashboard**
2. The dashboard will show:
   - Total entries from each system
   - Number of matching entries
   - List of differences
3. Click on any difference to see detailed comparison

### Step 7: Review Differences

When a difference is detected:
- A popup will show both entries side-by-side
- Differences are highlighted in yellow
- Summary shows the difference amount
- Your custom message for that account appears
- You can mark as reviewed or add notes

## 📊 Dashboard Features

### Summary View
- Total R365 entries
- Total Toast entries
- Matching entries count
- Differences count
- Total variance amount

### Difference List
Filter by:
- Account type
- Date range
- Difference amount threshold
- Status (reviewed/unreviewed)

### Comparison View
- Left panel: R365 entry details
- Right panel: Toast entry details
- Center: Highlighted differences
- Bottom: Summary and custom message

## 🔒 Privacy & Security

- **All data stays local** in your browser (uses Chrome storage API)
- **No external servers** - no data is sent anywhere
- **Uses your existing login** - the extension reads data from pages you're already logged into
- **No API keys needed** - scrapes visible webpage data only

## ⚙️ Settings Options

### General Settings
- Date range for comparison
- Minimum difference amount to trigger alerts
- Auto-extract on page load (optional)

### Account Mappings
- R365 to Chart of Accounts mapping
- Toast to Chart of Accounts mapping
- Export/Import mappings (JSON)

### Alert Configuration
- Custom messages per account
- Alert threshold amounts
- Notification preferences

### Data Management
- View all extracted entries
- Clear R365 data
- Clear Toast data
- Export data to CSV

## 🛠️ Troubleshooting

### Extension doesn't detect R365/Toast
- Make sure you're on the correct website domain
- Refresh the page after installing the extension
- Check if the extension is enabled in `chrome://extensions/`

### Data extraction fails
- Ensure you're logged into the website
- The website layout may have changed - check for extension updates
- Try manually triggering extraction from the extension popup

### Mappings not saving
- Check browser storage permissions
- Make sure Developer mode is enabled
- Try reinstalling the extension

### Comparison not showing differences
- Verify both R365 and Toast data have been extracted
- Check that account mappings are complete
- Ensure date ranges overlap between the two systems

## 📝 Data Format

### Journal Entry Structure
```json
{
  "date": "2025-12-12",
  "account": "Cash",
  "description": "Daily sales deposit",
  "debit": 1500.00,
  "credit": 0.00,
  "reference": "DEP-001",
  "source": "R365"
}
```

## 🤝 Contributing

This is a private tool for your accounting reconciliation. If you need modifications:
1. Edit the relevant files in `/scripts`, `/pages`, or `/styles`
2. Test changes by reloading the extension in `chrome://extensions/`
3. Document any custom changes you make

## 📄 License

Private use only.

## ⚠️ Disclaimer

This extension scrapes data from websites you have legitimate access to. Always comply with the terms of service of R365 and Toast POS. The extension is for personal/business use to facilitate your own accounting reconciliation.

## 📞 Support

For issues or questions, refer to the troubleshooting section above or modify the code to fit your specific needs.

---

**Version**: 1.0.0  
**Last Updated**: December 2025