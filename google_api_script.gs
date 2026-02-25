/**
 * Google Apps Script Web App endpoint for till submissions.
 *
 * Setup:
 * 1) Create a Google Sheet and copy its ID.
 * 2) Set SHEET_ID and SHEET_NAME below.
 * 3) Deploy as Web App with access "Anyone with the link".
 * 4) POST JSON payloads where keys match the header names in HEADERS.
 */

const SHEET_ID = 'REPLACE_WITH_GOOGLE_SHEET_ID';
const SHEET_NAME = 'Form Responses';

const HEADERS = [
  'Submission Date',
  'FIrst Name',
  'Last Name',
  "Coworker\'s Name - First Name",
  "Coworker\'s Name - Last Name",
  'Time',
  'Date of Shift',
  'Store Location',
  'Total AM Shift Tips',
  'Total PM Shift Tips',
  'Claimed CC Tips AM',
  'Claimed CC tips PM',
  'Expenses (Usually 0)',
  'Money Left in Till - Value of Coins',
  "Money Left in Till - Value of 1's",
  "Money Left in Till - Value of 5's",
  "Money Left in Till - Value of 10's",
  "Money Left in Till - Value of 20's",
  "Money Left in Till - Value of 50's",
  "Money Left in Till - Value of 100's",
  'AM Till Total',
  'AM Till Total (Counted at start of PM Shift)',
  'Cash Deposit - Value of Coins for Deposit',
  "Cash Deposit - Value of 1's",
  "Cash Deposit - Value of 5's",
  "Cash Deposit - Value of 10's",
  "Cash Deposit - Value of 20's",
  "Cash Deposit - Value of 50's",
  "Cash Deposit - Value of 100's (Please do not take 100's)",
  'AM Credit Card Charges',
  'PM Credit Card Charges',
  'AM Shift Total',
  'PM Shift Total',
  'AM Total Collected',
  'PM Total Collected',
  'AM "Gift Card x ____"',
  'PM "Gift Card x ____"',
  'AM Free Drink Discount',
  'PM Free Drink Discount',
  'Starting Cash',
  'AM Daily Sales',
  'PM Daily Sales',
  'AM Mishandled Cash',
  'AM Mishandled Cash (AM Shift Previously Posted on Group Me)',
  'PM Mishandled Cash (Post to Group Me)',
  'Last Update Date',
  'AM Cash Sales',
  'PM Cash Sales',
  'Conditional Time AM Vs PM',
  'PM Till Total',
  'Deposit Total',
  'Cash Tips where the answers submitted on this form are written'
];

/**
 * Accepts JSON body or URL params and appends one row to the sheet.
 */
function doPost(e) {
  try {
    const payload = getPayload_(e);
    const sheet = getSheet_();

    ensureHeaderRow_(sheet);

    const row = HEADERS.map((header) => payload[header] ?? '');
    sheet.appendRow(row);

    return jsonResponse_({
      ok: true,
      message: 'Row appended',
      rowNumber: sheet.getLastRow()
    });
  } catch (error) {
    return jsonResponse_({
      ok: false,
      message: String(error && error.message ? error.message : error)
    });
  }
}

/**
 * Optional GET health-check.
 */
function doGet() {
  return jsonResponse_({
    ok: true,
    message: 'Till form endpoint ready',
    expectedHeaders: HEADERS.length
  });
}

function getSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  const sheet = spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);
  return sheet;
}

function ensureHeaderRow_(sheet) {
  const hasData = sheet.getLastRow() > 0;
  if (!hasData) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    return;
  }

  const currentHeaders = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const headersMatch = HEADERS.every((header, index) => String(currentHeaders[index] || '').trim() === header);

  if (!headersMatch) {
    throw new Error('Header row does not match expected format. Please verify the first row in the target sheet.');
  }
}

function getPayload_(e) {
  if (e && e.postData && e.postData.contents) {
    const body = e.postData.contents.trim();
    if (body) {
      return JSON.parse(body);
    }
  }
  return (e && e.parameter) ? e.parameter : {};
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
