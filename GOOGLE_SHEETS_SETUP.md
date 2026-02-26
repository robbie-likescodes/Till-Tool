# Google Sheets Writeback Script

This repo includes a Google Apps Script endpoint at `google-sheets-sync.gs` that accepts browser submissions and writes them to your sheet using your requested header order, with no device-level setup.

## Pre-filled values from your request
- Script ID: `1GQlBBTuoOKVxS4pxm5mQQVE5hz64CmzAe0T01dYgIDxycfsSPAIdjDtn`
- Web app URL: `https://script.google.com/macros/s/AKfycbxT-L_bfvFeoC2ps8945uZcWeGt8k3p3sSP0K2ahVaRwUWnyf5nPPFWTXmpRqZVTGJn/exec`
- Worksheet/tab name: `Entries from Form`

## 1) Add the Apps Script code
- Open [script.google.com](https://script.google.com/), and open your project with script ID above.
- Paste in the contents of `google-sheets-sync.gs`.

## 2) Configure sheet targeting
You have two options (both now work from either code constants or Script Properties):
- **Recommended:** set `SHEET_ID` (most reliable and simplest).
- **Alternative:** set `SHEET_URL` and the script will parse the spreadsheet ID from the URL.

### Option A: set constants in code
- In `google-sheets-sync.gs`, set `SHEET_ID` or `SHEET_URL` directly.

### Option B: set Script Properties (no code changes needed)
- In Apps Script, open **Project Settings** → **Script Properties**.
- Add `SHEET_ID` (preferred) or `SHEET_URL`.
- Save and redeploy the Web App version.

> Avoid name-based lookups. They require additional Google Drive scopes and can fail with permissions errors in deployed web apps.

## 3) Initialize headers
- Run `initializeSheet()` once from the Apps Script editor.
- This writes the exact header template and validates future runs against it.

### Header template (copy/paste order)
```
Submission Date
FIrst Name
 Last Name
Time
Date of Shift
Store Location
Total AM Shift Tips
Total PM Shift Tips
Claimed CC Tips AM
Claimed CC tips PM
Expenses (Usually 0)
Money Left in Till - Value of Coins
Money Left in Till - Value of 1's 
Money Left in Till - Value of 5's
Money Left in Till - Value of 10's 
Money Left in Till - Value of 20's 
Money Left in Till - Value of 50's 
Money Left in Till - Value of 100's
AM Till Total
AM Till Total (Counted at start of PM Shift)
Cash Deposit - Value of Coins for Deposit
Cash Deposit - Value of 1's 
Cash Deposit - Value of 5's 
Cash Deposit - Value of 10's 
Cash Deposit - Value of 20's 
Cash Deposit - Value of 50's 
Cash Deposit - Value of 100's (Please do not take 100's)
AM Credit Card Charges
PM Credit Card Charges
AM Shift Total
PM Shift Total
AM Total Collected
PM Total Collected
AM "Gift Card x ____"
PM "Gift Card x ____"
AM Free Drink Discount 
PM Free Drink Discount
Starting Cash
AM Daily Sales
PM Daily Sales
AM Mishandled Cash
AM Mishandled Cash (AM Shift Previously Posted on Group Me)
PM Mishandled Cash (Post to Group Me)
AM Cash Sales
PM Cash Sales
Conditional Time AM Vs PM
PM Till Total
Deposit Total
AM Notes
PM Notes
Cash Tips
Submission ID
My Signature
```

## 4) Deploy / verify Web App
- **Deploy > New deployment > Web app**
- Execute as: **Me**
- Who has access: **Anyone** (or your org policy equivalent)
- Confirm the deployed URL matches the URL above.

## 5) Front-end connection (cloud-only)
- Set your deployed Apps Script Web App URL in one of these browser-safe places:
  - `index.html` meta tag: `<meta name="till-endpoint" content="https://script.google.com/macros/s/.../exec" />`
  - or runtime config: `window.TILL_CONFIG = { endpoint: "https://script.google.com/macros/s/.../exec" }`
- The app now rejects non-HTTPS and non-Google Apps Script hosts for the endpoint.
- If the endpoint is missing, the UI shows a configuration message instead of attempting local/system workarounds.

## Notes
- Supports both existing payload styles:
  - `Shift Sales Form` payloads (`source: "Web App"`)
  - `Tip Claim` payloads (`source: "Tip Claim"`)
- Unknown fields are ignored.
- Missing optional columns are left blank.
- `Submission Date` is generated server-side.

## 6) Security hardening
- Backend validates required fields and numeric fields before writing to Sheets.
- Backend now supports `action=lookup_am` for PM prefill and returns only the latest matching AM row (store+date), minimizing data exposure.
- Keep deployment access scoped to your organization when possible and always use HTTPS web app URLs.
