/**
 * Google Apps Script endpoint for Till-Tool.
 *
 * Usage:
 * 1) Create/open your target Google Sheet.
 * 2) Set SHEET_ID (recommended) OR use SHEET_DOC_NAME fallback.
 * 3) Run initializeSheet() once.
 * 4) Deploy as Web App (Anyone with link).
 * 5) Put the web app URL in app.js ENDPOINT.
 */

const SCRIPT_ID = '1GQlBBTuoOKVxS4pxm5mQQVE5hz64CmzAe0T01dYgIDxycfsSPAIdjDtn';
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxbpXZPqE4uViwMK6a9XR2oY6PWvxByXwhAx2glpKZX4xfOy-w1DU509LZvsfB81jzN/exec';
const SHEET_ID = ''; // Recommended: paste spreadsheet ID here.
const SHEET_DOC_NAME = 'Scan Till Tool';
const SHEET_NAME = 'Entries from Form';

const HEADERS = [
  'Submission Date',
  'FIrst Name',
  ' Last Name',
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
  "Money Left in Till - Value of 1's ",
  "Money Left in Till - Value of 5's",
  "Money Left in Till - Value of 10's ",
  "Money Left in Till - Value of 20's ",
  "Money Left in Till - Value of 50's ",
  "Money Left in Till - Value of 100's",
  'AM Till Total',
  'AM Till Total (Counted at start of PM Shift)',
  'Cash Deposit - Value of Coins for Deposit',
  "Cash Deposit - Value of 1's ",
  "Cash Deposit - Value of 5's ",
  "Cash Deposit - Value of 10's ",
  "Cash Deposit - Value of 20's ",
  "Cash Deposit - Value of 50's ",
  "Cash Deposit - Value of 100's (Please do not take 100's)",
  'AM Credit Card Charges',
  'PM Credit Card Charges',
  'AM Shift Total',
  'PM Shift Total',
  'AM Total Collected',
  'PM Total Collected',
  'AM "Gift Card x ____"',
  'PM "Gift Card x ____"',
  'AM Free Drink Discount ',
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
  'Cash Tips',
];

function doPost(e) {
  try {
    const payload = getPayload_(e);
    const sheet = getSheet_();
    ensureHeaders_(sheet);

    const row = buildRow_(payload);
    sheet.appendRow(row);

    return jsonResponse_({ ok: true, message: 'Saved', rowLength: row.length });
  } catch (error) {
    return jsonResponse_({
      ok: false,
      error: error && error.message ? error.message : String(error),
    });
  }
}

function doGet() {
  return jsonResponse_({ ok: true, service: 'Till-Tool Google Sheets endpoint' });
}

function initializeSheet() {
  const sheet = getSheet_();
  ensureHeaders_(sheet);
}

function getSheet_() {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  return sheet;
}

function getSpreadsheet_() {
  if (SHEET_ID) {
    return SpreadsheetApp.openById(SHEET_ID);
  }

  const files = DriveApp.getFilesByName(SHEET_DOC_NAME);
  if (!files.hasNext()) {
    throw new Error(`Spreadsheet not found by name: "${SHEET_DOC_NAME}". Set SHEET_ID instead.`);
  }

  const file = files.next();
  const spreadsheetId = file.getId();
  return SpreadsheetApp.openById(spreadsheetId);
}

function ensureHeaders_(sheet) {
  const firstRow = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const needsHeaders = firstRow.every((v) => !v);

  if (needsHeaders) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    return;
  }

  const mismatch = HEADERS.some((h, i) => firstRow[i] !== h);
  if (mismatch) {
    throw new Error('Header row does not match expected template. Update row 1 manually or use a fresh sheet.');
  }
}

function getPayload_(e) {
  const params = (e && e.parameter) || {};

  if (Object.keys(params).length) {
    return normalizePayload_(params);
  }

  const raw = e && e.postData && e.postData.contents;
  if (!raw) return {};

  try {
    return normalizePayload_(JSON.parse(raw));
  } catch (err) {
    return normalizePayload_({});
  }
}

function normalizePayload_(payload) {
  const out = {};
  Object.keys(payload || {}).forEach((key) => {
    out[key] = cleanValue_(payload[key]);
  });
  return out;
}

function cleanValue_(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value.trim();
  return value;
}

function num_(value) {
  if (value === '' || value === null || value === undefined) return '';
  const n = Number(value);
  return Number.isFinite(n) ? n : '';
}

function pick_(payload, keys, fallback) {
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    if (payload[key] !== undefined && payload[key] !== null && payload[key] !== '') return payload[key];
  }
  return fallback === undefined ? '' : fallback;
}

function sum_(...values) {
  return values
    .map((v) => num_(v))
    .filter((v) => v !== '')
    .reduce((acc, cur) => acc + cur, 0);
}

function buildRow_(p) {
  const now = new Date();
  const shift = String(p.shift || '').toUpperCase();
  const conditionalShift = shift || inferShiftFromTime_(p.time_of_entry);

  const claimedCcAm = shift === 'AM' ? num_(pick_(p, ['sales_tc_cc_tips', 'cc_tips_claimed'])) : '';
  const claimedCcPm = shift === 'PM' ? num_(pick_(p, ['sales_tc_cc_tips', 'cc_tips_claimed'])) : '';

  const tillCoins = num_(pick_(p, ['am_till_coins', 'pm_till_coins']));
  const till1s = num_(pick_(p, ['am_till_1s', 'pm_till_1s']));
  const till5s = num_(pick_(p, ['am_till_5s', 'pm_till_5s']));
  const till10s = num_(pick_(p, ['am_till_10s', 'pm_till_10s']));
  const till20s = num_(pick_(p, ['am_till_20s', 'pm_till_20s']));
  const till50s = num_(pick_(p, ['am_till_50s', 'pm_till_50s']));
  const till100s = num_(pick_(p, ['am_till_100s', 'pm_till_100s']));

  const depCoins = num_(pick_(p, ['am_dep_coins', 'pm_dep_coins']));
  const dep1s = num_(pick_(p, ['am_dep_1s', 'pm_dep_1s']));
  const dep5s = num_(pick_(p, ['am_dep_5s', 'pm_dep_5s']));
  const dep10s = num_(pick_(p, ['am_dep_10s', 'pm_dep_10s']));
  const dep20s = num_(pick_(p, ['am_dep_20s', 'pm_dep_20s']));
  const dep50s = num_(pick_(p, ['am_dep_50s', 'pm_dep_50s']));
  const dep100s = num_(pick_(p, ['am_dep_100s', 'pm_dep_100s']));

  const depositTotal = sum_(p.am_cash_deposit_total, p.pm_cash_deposit_total, depCoins, dep1s, dep5s, dep10s, dep20s, dep50s, dep100s);

  return [
    Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
    p.first_name || p.tc_firstName || '',
    p.last_name || p.tc_lastName || '',
    p.coworker_first_name || '',
    p.coworker_last_name || '',
    p.time_of_entry || p.tc_time || '',
    p.todays_date || p.tc_date || '',
    p.store_location || p.tc_store || '',
    num_(p.am_tips),
    num_(p.pm_tips),
    claimedCcAm,
    claimedCcPm,
    num_(pick_(p, ['am_expenses', 'pm_expenses'])),
    tillCoins,
    till1s,
    till5s,
    till10s,
    till20s,
    till50s,
    till100s,
    num_(pick_(p, ['am_till_total', 'am_ending_cash'])),
    num_(pick_(p, ['pm_starting_cash'])),
    depCoins,
    dep1s,
    dep5s,
    dep10s,
    dep20s,
    dep50s,
    dep100s,
    num_(p.am_card_collected),
    num_(p.pm_card_collected),
    num_(p.am_shift_total),
    num_(p.pm_shift_total),
    num_(p.am_total_collected),
    num_(p.pm_total_collected),
    num_(p.am_gift_card_sales),
    num_(p.pm_gift_card_sales),
    num_(p.am_paid_in_out),
    num_(p.pm_paid_in_out),
    num_(pick_(p, ['am_starting_cash', 'pm_starting_cash'])),
    num_(p.am_sales_total),
    num_(p.pm_sales_total),
    num_(p.am_mishandled_cash),
    num_(p.am_mishandled_cash),
    num_(p.pm_mishandled_cash),
    Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
    num_(p.am_cash_sales),
    num_(p.pm_cash_sales),
    conditionalShift,
    num_(pick_(p, ['pm_till_total', 'pm_ending_cash'])),
    depositTotal,
    num_(pick_(p, ['sales_tc_cash_tips', 'cash_tips_claimed'])),
  ];
}

function inferShiftFromTime_(timeValue) {
  if (!timeValue || typeof timeValue !== 'string') return '';
  const parts = timeValue.split(':');
  if (!parts.length) return '';
  const hour = Number(parts[0]);
  if (!Number.isFinite(hour)) return '';
  return hour >= 15 ? 'PM' : 'AM';
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
