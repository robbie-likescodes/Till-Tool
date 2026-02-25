# Google Sheets Writeback Script

This repo includes a Google Apps Script endpoint at `google-sheets-sync.gs` that accepts submissions from `app.js` and writes them to your sheet using your requested header order.

## Pre-filled values from your request
- Script ID: `1GQlBBTuoOKVxS4pxm5mQQVE5hz64CmzAe0T01dYgIDxycfsSPAIdjDtn`
- Web app URL: `https://script.google.com/macros/s/AKfycbwN035wVgJ3Slszvg0EwkHxT5O9sJYMAQIbJWB9fCuHw10P2YnHy0Ckf_ZTKZ-kWA9o/exec`
- Spreadsheet document name: `Scan Till Tool`
- Worksheet/tab name: `Entries from Form`

## 1) Add the Apps Script code
- Open [script.google.com](https://script.google.com/), and open your project with script ID above.
- Paste in the contents of `google-sheets-sync.gs`.

## 2) Configure sheet targeting
You have two options:
- **Recommended:** set `SHEET_ID` (most reliable).
- **Fallback:** leave `SHEET_ID` blank and the script will look up the spreadsheet by name (`SHEET_DOC_NAME = "Scan Till Tool"`).

## 3) Initialize headers
- Run `initializeSheet()` once from the Apps Script editor.
- This writes the exact header template and validates future runs against it.

## 4) Deploy / verify Web App
- **Deploy > New deployment > Web app**
- Execute as: **Me**
- Who has access: **Anyone** (or your org policy equivalent)
- Confirm the deployed URL matches the URL above.

## 5) Front-end connection
- `app.js` is already configured to use the provided web app URL.

## Notes
- Supports both existing payload styles:
  - `Shift Sales Form` payloads (`source: "Web App"`)
  - `Tip Claim` payloads (`source: "Tip Claim"`)
- Unknown fields are ignored.
- Missing optional columns are left blank.
- `Submission Date` and `Last Update Date` are generated server-side.
